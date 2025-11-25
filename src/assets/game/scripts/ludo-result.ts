import { _decorator, sp, Component, UIOpacity, Vec3, SpriteFrame, Label, Node, Tween, SpriteAtlas } from "cc";
import { AnimationUtils } from "../../../extensions/shared-components/assets/shared/utils";
import { LudoDice } from "./ludo-dice";
import { calcTotalPoints, determineWinningChoice, pauseSpineAnimation } from "./ludo-helper";

import gc from "@sg/game-client-base";

const { ccclass, property } = _decorator;

interface IResultDiceFrames {
    dice1: SpriteFrame[];
    dice2: SpriteFrame[];
}

@ccclass
export class LudoResult extends Component {
    @property({ type: [LudoDice] })
    dicesComponent: LudoDice[] = [];

    @property(sp.Skeleton)
    diceSkeleton: sp.Skeleton = null;

    @property({ type: SpriteAtlas })
    diceAtlas: SpriteAtlas | null = null;

    @property({ type: Node })
    nodeResult: Node | null = null;

    @property({ type: Label })
    lblResult: Label | null = null;

    private resultDiceFrames: IResultDiceFrames = { dice1: [], dice2: [] };
    private diceSpriteFrames: SpriteFrame[] = [];
    private readonly DICE_POSITION_NUMBER = 7;
    private readonly LOOP_NUMBER = 2;
    private readonly DICE_END_FRAME = 11;

    private readonly DICE_VALUE = 6;
    RESULT_DURATION = 1.4;

    onLoad() {
        this.setResultTextVisibility(false);
        this.initDiceSpriteFrames();
    }

    private initDiceSpriteFrames() {
        if (this.diceAtlas) {
            this.diceSpriteFrames = this.diceAtlas.getSpriteFrames();
            this.diceSpriteFrames.sort((a, b) => a.name.localeCompare(b.name));
        }
    }

    private resetResultDiceFrames() {
        this.resultDiceFrames = { dice1: [], dice2: [] };
    }

    private stopAllDiceAnimation() {
        this.dicesComponent.forEach((dice) => dice.stopAnimation());
    }

    private getDiceAnimationName(roundId: number): string {
        const position = roundId % this.DICE_POSITION_NUMBER || this.DICE_POSITION_NUMBER;
        const nextPosition = (position % this.DICE_POSITION_NUMBER) + 1;

        return `s${position}-e${nextPosition}`;
    }

    showResultNoAnim(result: gc.GameServiceMessage.TResult, roundId: number) {
        this.stopAllDiceAnimation();
        if (this.diceSkeleton) {
            pauseSpineAnimation(this.diceSkeleton.getComponent(sp.Skeleton), 1, this.getDiceAnimationName(roundId));
        }
        this.dicesComponent.forEach((dice, index) => {
            const endPos = result[`dice${index + 1}`];
            const frame = this.diceSpriteFrames.find((spriteFrame) => spriteFrame.name === `end-${endPos}-${this.DICE_END_FRAME}`);
            if (frame) 
            {
                dice.setFrame(frame);
            }
        });
    }

    setResultTextVisibility(isShow: boolean) {
        if (!this.nodeResult) 
        {
            return;
        }

        this.nodeResult.active = isShow;

        const uiOpacity = this.nodeResult.getComponent(UIOpacity) || this.nodeResult.addComponent(UIOpacity);

        if (!isShow) {
            uiOpacity.opacity = 0;
            this.nodeResult.active = false;
            return;
        }

        this.nodeResult.active = true;
        uiOpacity.opacity = 0;
        this.nodeResult.setScale(new Vec3(1, 1, 1));
        new Tween(this.nodeResult)
            .to(0.2, { scale: new Vec3(1.2, 1.2, 1) }, { easing: "bounceOut" }) // Scale up
            .to(0.3, { scale: new Vec3(1, 1, 1) }) // Scale back to normal
            .call(() => {
                uiOpacity.opacity = 255;
            })
            .start();
    }

    showResultText(result: gc.GameServiceMessage.TResult) {
        const choiceWin = determineWinningChoice(calcTotalPoints(result));
        this.setResultText(choiceWin.toUpperCase());
        this.setResultTextVisibility(true);
    }

    setResultText(value: string) {
        if (this.lblResult && value) {
            this.lblResult.string = value;
        }
    }

    async showResultAnim(prevResult: gc.GameServiceMessage.TResult, result: gc.GameServiceMessage.TResult, roundId: number) {
        this.resetResultDiceFrames();
        this.stopAllDiceAnimation();
        this.setResultDiceFrames(prevResult, result);
        if (this.diceSkeleton) {
            AnimationUtils.playSpine(
                this.diceSkeleton.getComponent(sp.Skeleton),
                this.getDiceAnimationName(roundId),
                false,
                this.RESULT_DURATION
            );
        }

        this.dicesComponent.forEach((dice, index) => {
            dice.runAnimation(this.resultDiceFrames[`dice${index + 1}`], this.RESULT_DURATION);
        });

        await AnimationUtils.delayTime(this.RESULT_DURATION);
        this.showResultText(result);
    }

    private getRandomNumber(max: number): number {
        return Math.floor(Math.random() * max) + 1; // NOSONAR
    }

    private setResultDiceFrames(prevResult: gc.GameServiceMessage.TResult, result: gc.GameServiceMessage.TResult) {
        for (let i = 0; i < this.dicesComponent.length; i++) {
            const startPos = prevResult?.[`dice${i + 1}`] ?? this.getRandomNumber(this.DICE_VALUE);
            const endPos = result[`dice${i + 1}`];
            const files = [`start-${startPos}`, `loop-${this.getRandomNumber(this.LOOP_NUMBER)}`, `end-${endPos}`];

            for (const file of files) {
                const matchingFrames = this.diceSpriteFrames.filter((frame) => frame.name.startsWith(file));
                this.resultDiceFrames[`dice${i + 1}`].push(...matchingFrames);
            }
        }
    }
}
