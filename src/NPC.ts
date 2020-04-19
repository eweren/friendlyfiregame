import { Face } from './Face';
import { ScriptedDialog } from './ScriptedDialog';
import { PhysicsEntity } from "./PhysicsEntity";

export abstract class NPC extends PhysicsEntity {
    public hasDialog = false;
    public face: Face | null = null;
    public scriptedDialog: ScriptedDialog | null = null;

    abstract startDialog(): void;

    protected drawFace(ctx: CanvasRenderingContext2D): void {
        if (this.face) {
            this.face.draw(ctx);
        }
    }

    protected drawDialog(ctx: CanvasRenderingContext2D): void {
        this.scriptedDialog?.draw(ctx);
    }

    protected updateDialog(dt: number) {
        this.scriptedDialog?.update(dt);
    }
}
