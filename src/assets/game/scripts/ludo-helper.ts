import gc from "@sg/game-client-base";
import { BetChoice } from "./ludo-choices";

import { sp } from "cc";

export const findWinningChoice = (settlementResult: any): string => {
    return Object.keys(settlementResult).find((key) => settlementResult[key] === true);
};

export const determineWinningChoice = (totalPoints: number): string => {
    const winChoice = totalPoints % 2 === 0 ? BetChoice.EVEN : BetChoice.ODD;
    return gc.Translator.gameTranslate(`glossary_${winChoice}`);
};

export const calcTotalPoints = (result: gc.GameServiceMessage.TResult): number => {
    return ["dice1", "dice2"].map((key) => result[key]).reduce((sum, value) => sum + value, 0);
};

export const pauseSpineAnimation = (spineAnimation: sp.Skeleton, startProgress: number, animationName) => {
    spineAnimation.node.active = true;
    spineAnimation.timeScale = 0;
    spineAnimation.setAnimation(0, animationName, false);
    const trackEntry = spineAnimation.getCurrent(0);
    trackEntry.animationStart = trackEntry.animationEnd * startProgress;
};
