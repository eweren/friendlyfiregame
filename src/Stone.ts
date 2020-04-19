import { entity } from "./Entity";
import { Game } from "./game";
import { Sprites, getSpriteIndex } from "./Sprites";
import { loadImage } from "./graphics";
import { STONE_ANIMATION } from "./constants";
import { NPC } from './NPC';
import { EyeType, Face } from './Face';

@entity("stone")
export class Stone extends NPC {
    private sprites!: Sprites;
    private spriteIndex = 0;

    public constructor(game: Game, x: number, y:number) {
        super(game, x, y, 26, 54);
        this.face = new Face(this, EyeType.STONE, 1, 0, 21);
    }

    public async load(): Promise<void> {
        this.sprites = new Sprites(await loadImage("sprites/stone.png"), 3, 1);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.translate(this.x, -this.y + 1);
        this.sprites.draw(ctx, this.spriteIndex);
        ctx.restore();
        this.face?.draw(ctx);
    }

    update(dt: number): void {
        this.spriteIndex = getSpriteIndex(0, STONE_ANIMATION);
    }
    startDialog(): void {
    }
}