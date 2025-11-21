import gc from "@sg/game-client-base";
import { Label, Node, _decorator, tween } from "cc";
import { AudioUtils } from "db://shared-components/game/audios/utils";
import GameComponent from "db://shared-components/game/scripts/components/game-component";
import { startGame } from "db://shared-components/shared/scripts/startup";
import { AnimationUtils } from "db://shared-components/shared/utils";
import Observer from "observer";
import { siteConfigs } from "../../../scripts/site-configs";
import { settings } from "../game-settings";
import { containerOptions } from "../containerOptions";
import "./../../../resources/i18n";
import { SevenUpDownResult } from "../seven-up-down-result";
const { Rounds, Translator } = gc;

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
    protected lastRound: gc.RoundHistories.RoundHistory = {
        "result": {
          "dice1": 5,
          "dice2": 6,
          "multiplier": {
            "value": 9,
            "choice": "up"
          }
        },
        "settlementResult": {
          "up": true,
          "down": false,
          "seven": false
        },
        "roundId": 758757
      };
    protected roundId: number = null;
    override namespace = settings.name;
    override containerOptions = containerOptions;
    isLoading = true;
    isFinishDiceAnim = false;

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

    @render(Rounds.RoundStore, (store) => store.clientRoundId)
    storeClientRoundId(clientRoundId: number) {
        this.clientRoundId = clientRoundId;
        this.calculateForDices(clientRoundId);
    }

    @render(Rounds.RoundTimeStore, (store) => store.isInRoundTime)
    renderInRoundTime(isInRoundTime: boolean) {
        if (isInRoundTime && !this.hasResetBox && !this.isLoading) {
            this.resetColorBox();
            this.resultComp?.setResultTextVisibility(false);
        }
    }

    calculateForDices(roundId: number) {
        const seedNumber = 123;
        const temp = (roundId * seedNumber).toString().slice(-3);
        this.randomResults = [];
        for (let i = 0; i < 3; i++) {
            this.randomResults.push(+temp[i] % 6);
        }
    }

    async showResult(
        result: gc.GameServiceMessage.TResult,
        hasAnimation: boolean,
        settlementResult: gc.GameServiceMessage.TSettlementResult
    ) {
        result = {
            dice1: 2,
            dice2: 1,
            multiplier: {
                value: 2,
                choice: "up",
            },
        };

        if (result) {
            const results = Object.values(result);
            this.hasResetBox = false;
            this.resultComp?.setResultTextVisibility(false);
            this.loadSoundResultBeforeRead(result);

            if (hasAnimation) {
                this.handleDiceDropSound();
                await AnimationUtils.delayTime(this.delayTimeShowWinningBox);
                await this.showResultAnim(results, this.roundId, settlementResult);
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

    async loadSoundResultBeforeRead(data: gc.GameServiceMessage.TResult) {
        let isCancelLoadSounds = false;
        const maxWaitTime = 5000;
        const results = Object.values(data);

        const timeoutCancelWinningSound = setTimeout(() => {
            isCancelLoadSounds = true;
        }, maxWaitTime);

        for (const result of results) {
            if (isCancelLoadSounds) {
                break;
            }
            const soundId = this.getAudioKeyForLanguage("blue_en");
            if (soundId) {
                const duration = await AudioUtils.getDurationClip(soundId);

                if (duration > 0) {
                    this.resultsSoundInfo.push({ soundId, duration });
                }
            }
        }

        timeoutCancelWinningSound && clearTimeout(timeoutCancelWinningSound);
    }

    @render(gc.RoundHistories.RoundHistoryStore, (store) => store.getLastRound())
    public setLastRound(round: gc.RoundHistories.RoundHistory) {
        this.lastRound =  {
            "result": {
              "dice1": 5,
              "dice2": 6,
              "multiplier": {
                "value": 9,
                "choice": "up"
              }
            },
            "settlementResult": {
              "up": true,
              "down": false,
              "seven": false
            },
            "roundId": 758757
          };
    }

    @render(gc.Settlements.SettlementStore, (store) => store.roundId)
    public updateLatestRoundId(roundId: number) {
        this.roundId = roundId;
    }

    getAudioKeyForLanguage(name: string): string {
        return `${name}_${Translator.getLanguageId() || "en"}`;
    }

    async handleStartRound(isStartRound: boolean) {
        if (isStartRound) {
            super.handleStartRound(isStartRound);
            this.calculateForDices(this.clientRoundId + 1);
            this.resetColorBox();
            this.resultsSoundInfo = [];
        }
    }

    private resetColorBox() {
        this.hasResetBox = true;
    }

    @render(gc.App.AppStore, (store) => store.isLoading)
    updateLoading(isLoading: boolean) {
        this.isLoading = isLoading;
    }
}
