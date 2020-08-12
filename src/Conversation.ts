import { NPC } from './NPC';
import { DialogJSON } from "*.dialog.json";

export interface Interaction {
    npcLine: ConversationLine | null;
    options: ConversationLine[];
    spoiledOptions: ConversationLine[];
};

// Actions that shall be executed before an NPC talks, not after
const earlyActions = [
    "angry",
    "sad",
    "amused",
    "neutral",
    "bored"
];

const globalVariables: Record<string, string> = {};

export class Conversation {
    private states: string[];
    private data: {[key: string]: ConversationLine[]};
    private state!: string;
    private stateIndex = 0;
    private endConversation = false;
    private localVariables: Record<string, string> = {};
    private skippedLines = 0; // help variable to make goBack() work with skipped dialog lines due to conditions

    constructor(json: DialogJSON, private readonly npc: NPC) {
        this.states = Object.keys(json);
        this.data = {};
        for (const state of this.states) {
            this.data[state] = json[state].map(line => new ConversationLine(line, this));
        }
        this.setState("entry");
        this.endConversation = false;
    }

    public setState(name = "entry") {
        if (!this.states.includes(name)) {
            throw new Error("State name " + name + " does not exist in conversation");
        }
        this.state = name;
        this.stateIndex = 0;
    }

    public getNextInteraction(): Interaction | null {
        if (this.endConversation) {
            this.endConversation = false;
            return null;
        }
        this.skippedLines = 0;
        const result: Interaction = {
            npcLine: null,
            options: [],
            spoiledOptions: []
        };
        // Does NPC speak?
        const line = this.getNextLine()
        if (line == null) {
            // Conversation is over without changing state or anything
            return null;
        } else {
            if (line.isNpc) {
                result.npcLine = line;
            } else {
                this.goBack(1 + this.skippedLines);
            }
        }
        // Does Player react?
        this.skippedLines = 0;
        let option = this.getNextLine();
        while (option && !option.isNpc) {
            // TODO identify spoiled options (that don't lead to anything new for the player) and sort accordingly
            result.options.push(option);
            this.skippedLines = 0;
            option = this.getNextLine();
        }
        if (option && !option.isNpc) {
            this.goBack();
        } else {
            this.goBack(1 + this.skippedLines);
        }
        // shuffle(result.options);
        this.skippedLines = 0;
        return result;
    }

    public runAction(action: string[]) {
        switch (action[0]) {
            case "end":
                this.endConversation = true;
                break;
            case "set":
                this.setVariable(action[1], action[2]);
                break;
            default:
                this.npc.scene.game.campaign.runAction(action[0], this.npc, action.slice(1));
        }
    }

    private setVariable(name = "", value = "true"): void {
        if (name.startsWith("$")) {
            // Global variable
            globalVariables[name] = value;
        } else {
            // Local variable
            this.localVariables[name] = value;
        }
    }

    public static setGlobal(varname: string, value = "true"): void {
        if (!varname.startsWith("$")) {
            varname = "$" + varname;
        }
        globalVariables[varname] = value;
    }

    public static getGlobals() {
        return globalVariables;
    }

    private getVariable(name: string): string {
        if (name.startsWith("$")) {
            return globalVariables[name];
        } else {
            return this.localVariables[name];
        }
    }

    private goBack(steps = 1) {
        if (steps <= 0) {
            return;
        }
        // const prev = this.stateIndex;
        this.stateIndex -= steps;
        this.skippedLines = 0;
    }

    private getNextLine(ignoreDisabled = false): ConversationLine | null {
        if (this.stateIndex >= this.data[this.state].length) {
            return null;
        }
        let line = this.data[this.state][this.stateIndex++];
        // console.log(line.condition);
        if (line.condition && (!ignoreDisabled && !this.testCondition(line.condition))) {
            this.skippedLines++;
            return this.getNextLine(ignoreDisabled);
        }
        return line;
    }

    private testCondition(condition: string): boolean {
        const self = this;
        const subconditions = condition.split(',');
        // console.log(subconditions);
        const result = subconditions.some(evaluateFragment);
        // console.log("Condition ", condition, " yields ", result);
        return result;

        function evaluateFragment(s: string): boolean {
            if (s.startsWith('not ')) {
                return !evaluateFragment(s.substr(4));
            } else {
                if (s.includes('!=')) {
                    const values = s.split('!=').map(s => s.trim());
                    return self.getVariable(values[0]) != values[1];
                } else if (s.includes('=')) {
                    const values = s.split('=').map(s => s.trim());
                    return self.getVariable(values[0]) == values[1];
                } else if (s.includes('>')) {
                    const values = s.split('>').map(s => s.trim());
                    return parseFloat(self.getVariable(values[0])) > parseFloat(values[1]);
                } else if (s.includes('<')) {
                    const values = s.split('<').map(s => s.trim());
                    return parseFloat(self.getVariable(values[0])) < parseFloat(values[1]);
                }
            }
            // Variable name only
            const v = self.getVariable(s.trim());
            return v != null && v != "" && v != "0" && v != "false";
        }
    }

    public hasEnded() {
        return this.endConversation;
    }
}


const MAX_CHARS_PER_LINE = 50;

export class ConversationLine {
    public static OPTION_MARKER = '►';
    public readonly line: string;
    public readonly condition: string | null;
    public readonly targetState: string | null;
    public readonly actions: string[][];
    public readonly isNpc: boolean;
    private visited = false;

    constructor(
        public readonly full: string,
        public readonly conversation: Conversation
    ) {
        this.isNpc = !full.startsWith("►");
        this.line = ConversationLine.extractText(full, this.isNpc);
        this.condition = ConversationLine.extractCondition(full);
        this.targetState = ConversationLine.extractState(full);
        this.actions = ConversationLine.extractActions(full);
        this.visited = false;
    }

    public executeBeforeLine() {
        if (this.actions.length > 0) {
            for (const action of this.actions) {
                if (this.isEarlyAction(action[0])) {
                    this.conversation.runAction(action);
                }
            }
        }
    }

    public execute() {
        this.visited = true;
        if (this.targetState != null) {
            this.conversation.setState(this.targetState);
        }
        if (this.actions.length > 0) {
            for (const action of this.actions) {
                if (!this.isEarlyAction(action[0])) {
                    this.conversation.runAction(action);
                }
            }
        }
    }

    public isEarlyAction(s: string): boolean {
        return earlyActions.includes(s);
    }

    public wasVisited(): boolean {
        return this.visited;
    }

    private static extractText(line: string, autoWrap = false): string {
        // Remove player option sign
        if (line.startsWith(ConversationLine.OPTION_MARKER)) { line = line.substr(1); }

        // Remove conditions
        if (line.trim().startsWith("[") && line.includes("]")) {
            line = line.substr(line.indexOf("]") + 1).trim();
        }

        // Remove actions and state changes
        const atPos = line.indexOf("@")
        const exclPos = line.search(/\![a-zA-Z]/);

        if (atPos >= 0 || exclPos >= 0) {
            const minPos = (atPos >= 0 && exclPos >= 0) ? Math.min(atPos, exclPos) : (atPos >= 0) ? atPos : exclPos;
            line = line.substr(0, minPos).trim();
        }

        // Auto wrap to some character count
        if (autoWrap) {
            return ConversationLine.wrapString(line, MAX_CHARS_PER_LINE);
        }

        return line;
    }

    private static extractCondition(line: string): string | null {
        const conditionString = line.match(/\[[a-zA-Z0-9\_\<\>\!\=\$ ]+\]/g);
        // console.log(conditionString);
        if (conditionString && conditionString[0]) {
            return conditionString[0].substr(1, conditionString[0].length - 2);
        }
        return null;
    }

    private static extractState(line: string): string | null {
        const stateChanges = line.match(/(@[a-zA-Z0-9\_]+)/g);
        if (stateChanges && stateChanges.length > 0) {
            const stateName = stateChanges[0].substr(1);
            return stateName;
        }
        return null;
    }

    private static extractActions(line: string): string[][] {
        let actions = line.match(/(\![a-zA-Z][a-zA-Z0-9\_\$ ]*)+/g);
        const result = [];
        if (actions) {
            actions = actions.join(" ").split("!").map(action => action.trim()).filter(s => s.length > 0);
            for (const action of actions) {
                const segments = action.split(" ");
                result.push(segments);
            }
        }
        return result;
    }

    public static wrapString(s: string, charsPerLine: number): string {
        let currentLength = 0, lastSpace = -1;
        for (let i = 0; i < s.length; i++) {
            const char = s[i];
            if (char === "\n") {
                // New line
                currentLength = 0;
            } else {
                if (char === " ") {
                    lastSpace = i;
                }
                currentLength++;
                if (currentLength >= charsPerLine) {
                    if (lastSpace >= 0) {
                        // Add cut at last space
                        s = s.substr(0, lastSpace) + "\n" + s.substr(lastSpace + 1);
                        currentLength = i - lastSpace;
                        lastSpace = -1;
                    } else {
                        // Cut mid-word
                        s = s.substr(0, i + 1) + "\n" + s.substr(i + 1);
                        currentLength = 0;
                    }
                }
            }
        }
        return s;
    }
}
