import gc from "@sg/game-client-base";
import { Label, Node, _decorator, tween } from "cc";
import GameComponent from "db://shared-components/game/scripts/components/game-component";
import { startGame } from "db://shared-components/shared/scripts/startup";
import { AnimationUtils } from "db://shared-components/shared/utils";
import Observer from "observer";
import { siteConfigs } from "../../../scripts/site-configs";
import { settings } from "../game-settings";
import { containerOptions } from "../containerOptions";
import "./../../../resources/i18n";
import { SevenUpDownResult } from "../seven-up-down-result";
import { ISevenUpDownResult } from "../seven-up-down-choices";
const { Rounds, Translator, DisabledGame } = gc;

startGame(settings.name, containerOptions, siteConfigs);

const { ccclass, property } = _decorator;
const { observer, render, handle } = Observer;

type ResultSoundInfo = {
    soundId: string;
    duration: number;
};

@ccclass
@observer(settings.name)
export default class Game extends GameComponent {
    @property({ type: Label, override: true, visible: false })
    lblMinBet: Label = null;

    @property({ type: Label, override: true, visible: false })
    lblMaxBet: Label = null;

    @property({ type: Node })
    resultNode: Node = null;

    private resultComp: SevenUpDownResult = null;
    protected lastRound: gc.RoundHistories.RoundHistory = null;
    protected roundId: number = null;
    protected histories: gc.RoundHistories.RoundHistory[];
    override namespace = settings.name;
    override containerOptions = containerOptions;
    isLoading = true;
    isFinishDiceAnim = false;
    disabledGame: boolean = null;

    protected clientRoundId = -1;
    protected openAnimationIndex = 0;
    protected randomResults = [1, 1, 1];
    protected hasResetBox = false;
    protected diceDropSound = "dice_drop";
    protected delayDiceDropSound = 0.1;
    protected delayTimeShowWinningBox = 2;
    protected resultsSoundInfo: ResultSoundInfo[] = [];

    onLoad() {
        super.onLoad();
        console.log("Game onLoad");
        this.fetchComponents();
    }

    fetchComponents() {
        this.resultComp = this.resultNode.getComponent(SevenUpDownResult);
    }

    @render(DisabledGame.DisabledGameStore, (store) => store.disabled)
    storeDisabled(disabled: boolean) {
        this.disabledGame = disabled;
    }

    @render(Rounds.RoundStore, (store) => store.clientRoundId)
    storeClientRoundId(clientRoundId: number) {
        this.clientRoundId = clientRoundId;
    }

    @render(Rounds.RoundTimeStore, (store) => store.isInRoundTime)
    renderInRoundTime(isInRoundTime: boolean) {
        if (isInRoundTime && !this.hasResetBox && !this.isLoading) {
            this.resultComp?.setResultTextVisibility(false);
        }
    }

    @render(gc.RoundHistories.RoundHistoryStore, (store) => store.firstJoinGameHistory)
    async renderStaticResult(firstJoinGameHistory: gc.RoundHistories.IFirstJoinGameHistory) {
        if (!firstJoinGameHistory) {
            return;
        }

        this.resultComp?.showResultNoAnim(this.histories[1]?.result, this.histories[1]?.roundId);

        const { animationHighlight, roundTime, roundHistory: lastRound } = firstJoinGameHistory;

        if (!lastRound || roundTime < 0) {
            return;
        }

        const { result: rawResult, roundId } = lastRound;

        const result = this.convertToSevenUpDownResult(rawResult);
        if (this.disabledGame) {
            this.resultComp?.showResultNoAnim(result, roundId);
            this.resultComp?.showResultText(result);
            return null;
        }

        // Handle animations or static display
        if (animationHighlight && roundTime > settings.durations.wholeRound - 8) {
            await this.showResultAnim(result, roundId, result);
        } else {
            this.resultComp?.showResultNoAnim(result, roundId);
        }
    }

    private convertToSevenUpDownResult(rawResult: gc.GameServiceMessage.TResult): ISevenUpDownResult {
        return {
            dice1: rawResult["dice1"],
            dice2: rawResult["dice2"],
            multiplier: rawResult["multiplier"] ?? null,
        } as ISevenUpDownResult;
    }

    async showResult(
        result: gc.GameServiceMessage.TResult,
        hasAnimation: boolean,
        settlementResult: gc.GameServiceMessage.TSettlementResult
    ) {
        if (result) {
            this.hasResetBox = false;
            this.resultComp?.setResultTextVisibility(false);

            if (hasAnimation) {
                this.handleDiceDropSound();
                await AnimationUtils.delayTime(this.delayTimeShowWinningBox);
                await this.showResultAnim(result, this.roundId, settlementResult);
                this.winningSound();
            } else {
                this.resultComp?.setResultTextVisibility(true);
            }
        }
    }

    async showResultAnim(result: gc.GameServiceMessage.TResult, roundId: number, settlementResult): Promise<void> {
        const prevResult = this.lastRound?.result;
        this.resultComp.setResultTextVisibility(false);

        await new Promise<void>((resolve) => {
            tween(this.resultNode)
                .call(() => {
                    this.resultComp?.showResultAnim(prevResult, result, roundId); // Show the result animation
                })
                .delay(this.resultComp?.RESULT_DURATION || 0)
                .call(() => {
                    this.winningSound();
                })
                .call(() => resolve())
                .start();
        });

        this.isFinishDiceAnim = true;
    }

    async handleDiceDropSound() {
        await AnimationUtils.delayTime(this.delayDiceDropSound);
        this.playSound(this.diceDropSound);
    }

    async winningSound() {
        if (this.resultsSoundInfo.length > 1) {
            await this.playSequentialSounds();
        }
    }

    async playSequentialSounds() {
        for (const resultSoundInfo of this.resultsSoundInfo) {
            this.playSound(resultSoundInfo.soundId);
            await AnimationUtils.delayTime(resultSoundInfo.duration);
        }
    }

    @render(gc.RoundHistories.RoundHistoryStore, (store) => store.getLastRound())
    public setLastRound(round: gc.RoundHistories.RoundHistory) {
        this.lastRound = round;
    }

    @render(gc.Settlements.SettlementStore, (store) => store.roundId)
    public updateLatestRoundId(roundId: number) {
        this.roundId = roundId;
    }

    @render(gc.RoundHistories.RoundHistoryStore, (store) => store.histories)
    updateHistories(dataLogs: any[]) {
        this.histories = dataLogs;
    }

    getAudioKeyForLanguage(name: string): string {
        return `${name}_${Translator.getLanguageId() || "en"}`;
    }

    async handleStartRound(isStartRound: boolean) {
        if (isStartRound) {
            super.handleStartRound(isStartRound);
            this.resultComp?.setResultTextVisibility(false);
            this.resultsSoundInfo = [];
        }
    }

    @render(gc.App.AppStore, (store) => store.isLoading)
    updateLoading(isLoading: boolean) {
        this.isLoading = isLoading;
    }
}
