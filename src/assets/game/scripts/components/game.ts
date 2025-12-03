import gc from "@sg/game-client-base";
import { Label, Node, _decorator, tween, director } from "cc";
import mobx from "mobx";
import GameComponent from "db://shared-components/game/scripts/components/game-component";
import { startGame } from "db://shared-components/shared/scripts/startup";
import { AnimationUtils } from "db://shared-components/shared/utils";
import Observer from "observer";
import { siteConfigs } from "../../../scripts/site-configs";
import { settings } from "../game-settings";
import { containerOptions } from "../containerOptions";
import "./../../../resources/i18n";
import { LudoResult } from "../ludo-result";
import { ILudoResult } from "../ludo-choices";
import { GameBoardStore } from "../features/game-board-state/game-board-store";
import { GameServiceMessage } from "../features/game-messages";
import { GameRunnerComponent } from "../../../ludo-game-code/scripts/components/game-runner-component";
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

    private resultComp: LudoResult = null;
    protected lastRound: gc.RoundHistories.RoundHistory = null;
    protected roundId: number = null;
    protected histories: gc.RoundHistories.RoundHistory[];
    override namespace = settings.name;
    override containerOptions = containerOptions;
    isLoading = true;
    isFinishDiceAnim = false;
    isPlayAnimSettlement = false;

    disabledGame: boolean = null;

    protected clientRoundId = -1;
    protected openAnimationIndex = 0;
    protected randomResults = [1, 1, 1];
    protected hasResetBox = false;
    protected delayTimeShowWinningBox = 2;
    protected resultsSoundInfo: ResultSoundInfo[] = [];
    private gameRunnerComponent: GameRunnerComponent = null;

    onLoad() {
        super.onLoad();
        console.log("Game onLoad");
        this.fetchComponents();
    }

    fetchComponents() {
        this.resultComp = this.resultNode.getComponent(LudoResult);

        // Find GameRunnerComponent in the scene
        const scene = director.getScene();
        if (scene) {
            this.gameRunnerComponent = scene.getComponentInChildren(GameRunnerComponent);
            if (this.gameRunnerComponent) {
                console.log("GameRunnerComponent found");
                // Set initial SFX state
                this.gameRunnerComponent.setSfxEnabled(this.sfxEnabled);
            } else {
                console.warn("GameRunnerComponent not found in scene");
            }
        }
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

        const result = this.convertToLudoResult(rawResult);
        if (this.disabledGame) {
            this.resultComp?.showResultNoAnim(result, roundId);
            this.resultComp?.showResultText(result);
            return;
        }

        // Handle animations or static display
        if (animationHighlight && roundTime > settings.durations.wholeRound - 8 && !this.isPlayAnimSettlement) {
            await this.showResultAnim(result, roundId, result);
        } else {
            this.resultComp?.showResultNoAnim(result, roundId);
        }
    }

    private convertToLudoResult(rawResult: gc.GameServiceMessage.TResult): ILudoResult {
        return {
            dice1: rawResult["dice1"],
            dice2: rawResult["dice2"],
            action: rawResult["action"],
            board: rawResult["board"],
            currentPlayers: rawResult["currentPlayers"],
            nextTurnIndex: rawResult["nextTurnIndex"],
            winner: rawResult["winner"],
        } as ILudoResult;
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
                this.isPlayAnimSettlement = true;
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
                    this.playStoppableSFX("dice_shake");
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

    @handle(gc.Audios.AudioHandler, (handle, id: string) => handle.playStoppableSFX(id))
    playStoppableSFX(id: string) {
        return id;
    }

    getAudioKeyForLanguage(name: string): string {
        return `${name}_${Translator.getLanguageId() || "en"}`;
    }

    async handleStartRound(isStartRound: boolean) {
        if (isStartRound) {
            super.handleStartRound(isStartRound);
            this.resultComp?.setResultTextVisibility(false);
            this.resultsSoundInfo = [];
            this.isFinishDiceAnim = this.isPlayAnimSettlement = false;
        }
    }

    @render(gc.App.AppStore, (store) => store.isLoading)
    updateLoading(isLoading: boolean) {
        this.isLoading = isLoading;
    }

    @render(GameBoardStore, (store) => store.boardState)
    renderInitBoardState(boardState: GameServiceMessage.BoardState) {
        if (!boardState) {
            return;
        }

        // Convert MobX observable to plain JS object
        const boardStateJS = mobx.toJS(boardState) as GameServiceMessage.BoardState;
        console.log("[Game] renderInitBoardState", boardStateJS);

        // Apply state to GameRunnerComponent if available
        if (this.gameRunnerComponent) {
            // Set the initial game state
            this.gameRunnerComponent.setInitialGameState(boardStateJS);

            // Apply initial state instantly (horses positioned without animation)
            this.gameRunnerComponent.applyInitialGameState();
        }
    }

    @render(GameBoardStore, (store) => store.finishBoardState)
    renderFinishBoardState(boardState: GameServiceMessage.FinishBoardState) {
        if (!boardState?.result) {
            return;
        }

        const boardStateJS = mobx.toJS(boardState) as GameServiceMessage.FinishBoardState;
        console.log("[Game] renderFinishBoardState", boardStateJS);

        // Move dice result to the player's base
        if (this.gameRunnerComponent && this.resultNode) {
            this.gameRunnerComponent.moveDiceResultForFinishState(boardStateJS.result, this.resultNode);
        }

        // Wait 4 seconds before applying state
        if (this.gameRunnerComponent) {
            this.scheduleOnce(() => {
                this.gameRunnerComponent.applyGameState(boardStateJS.result);
            }, 4);
        }
    }

    @render(GameBoardStore, (store) => store.nextState)
    renderNextState(nextState: GameServiceMessage.NextState) {
        if (!nextState) {
            return;
        }

        const nextStateJS = mobx.toJS(nextState) as GameServiceMessage.NextState;
        console.log("[Game] renderNextState", nextStateJS);

        // Get the nextPlayer from nextAction
        const nextPlayer = nextStateJS.nextAction?.nextPlayer;

        // Move dice result to the next player's base
        if (this.gameRunnerComponent && this.resultNode && nextPlayer !== undefined && nextPlayer !== null) {
            this.gameRunnerComponent.moveDiceResultForNextState(nextPlayer, this.resultNode);
        }

        // Handle next state highlighting
        if (this.gameRunnerComponent) {
            this.gameRunnerComponent.handleNextState(nextStateJS);
        }
    }

    private sfxEnabled = true;

    @render(gc.UserSettings.UserSettingStore, (store) => store.sfxEnable)
    renderSfxComp(enable: boolean) {
        console.log("[Game] renderSfxComp", enable);
        this.sfxEnabled = enable;

        // Update SFX state in GameRunnerComponent if available
        if (this.gameRunnerComponent) {
            this.gameRunnerComponent.setSfxEnabled(enable);
        }
    }

    finishGame() {
        if (this.gameRunnerComponent) {
            this.gameRunnerComponent.finishGame(GameRunnerComponent.RESET_STATE, 1, 2);
        }
    }

    @handle(gc.Rounds.RoundRunningHandlers, (roundRunningHandlers) => roundRunningHandlers.stopRunner())
    stopRoundCountdown() {
        console.log("[Game] stopRoundCountdown");
    }

    @handle(gc.Rounds.RoundRunningHandlers, (roundRunningHandlers) => roundRunningHandlers.startRunner())
    startRoundCountdown() {
        console.log("[Game] startRoundCountdown");
    }
}
