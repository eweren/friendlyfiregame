import { entity } from "./Entity";
import { NPC } from './NPC';
import { Aseprite } from './Aseprite';
import { asset } from "./Assets";
import { GameScene } from "./scenes/GameScene";
import conversation from '../assets/dialog/table.dialog.json';
import { Conversation } from './Conversation';
import { RenderingLayer } from './Renderer';

@entity("table")
export class Table extends NPC {
    @asset("sprites/table.aseprite.json")
    private static sprite: Aseprite;

    public constructor(scene: GameScene, x: number, y:number) {
        super(scene, x, y, 18, 24);
        this.lookAtPlayer = false;
        this.conversation = new Conversation(conversation, this);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this.scene.renderer.addAseprite(Table.sprite, "idle", this.x, this.y, RenderingLayer.ENTITIES, this.direction);
        if (this.scene.showBounds) this.drawBounds();
        this.speechBubble.draw(ctx);
    }

    update(dt: number): void {
        super.update(dt);
        this.speechBubble.update(this.x, this.y);
    }
}
