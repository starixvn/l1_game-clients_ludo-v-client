import gc from "@sg/game-client-base";
import { BetChoice } from "./seven-up-down-choices";

import { sp } from "cc";

export const findWinningChoice = (settlementResult: any): string => {
    return Object.keys(settlementResult).find((key) => settlementResult[key] === true);
};

export const determineWinningChoice = (totalPoints: number): string => {
    if (totalPoints === 7) {
        return gc.Translator.gameTranslate(`glossary_${BetChoice.SEVEN}`);
    }
    const winChoice = totalPoints > 6 ? `${BetChoice.UP}` : `${BetChoice.DOWN}`;
    const choiceName = `glossary_${winChoice}`;
    return `${totalPoints} - ${gc.Translator.gameTranslate(choiceName)}`;
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
