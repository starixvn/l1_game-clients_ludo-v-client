import gc from "@sg/game-client-base";
import { Label, Node, _decorator } from "cc";
import { AudioUtils } from "db://shared-components/game/audios/utils";
import GameComponent from "db://shared-components/game/scripts/components/game-component";
import { startGame } from "db://shared-components/shared/scripts/startup";
import { AnimationUtils } from "db://shared-components/shared/utils";
import Observer from "observer";
import { siteConfigs } from "../../../scripts/site-configs";
import { settings } from "../game-settings";
import { containerOptions } from "../containerOptions";
import "./../../../resources/i18n";
import { ColorGameWinningResult } from "./winning-result";
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
    winningResultNode: Node = null;


    private winningResult: ColorGameWinningResult = null;

    override namespace = settings.name;
    override containerOptions = containerOptions;
    isLoading = true;


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
        this.fetchComponents();
        this.winningResult.hideQuickly();
    }

    fetchComponents() {
        this.winningResult = this.winningResultNode.getComponent(ColorGameWinningResult);
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
            this.winningResult.hideQuickly();
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

    async showResult(result: gc.GameServiceMessage.TResult, hasAnimation: boolean) {
        if (result) {
            const results = Object.values(result);
            const animationIndex = this.openAnimationIndex;
            this.hasResetBox = false;
            this.winningResult.setResult(result);
            this.loadSoundResultBeforeRead(result);
            if (hasAnimation) {
                this.handleDiceDropSound();
                await AnimationUtils.delayTime(this.delayTimeShowWinningBox);
                this.winningResult.show();
                this.winningSound();
            } else {
                this.winningResult.showQuickly();
            }
        }
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

    getAudioKeyForLanguage(name: string): string {
        return `${name}_${Translator.getLanguageId() || "en"}`;
    }

    async handleStartRound(isStartRound: boolean) {
        if (isStartRound) {
            super.handleStartRound(isStartRound);
            this.calculateForDices(this.clientRoundId + 1);
            this.resetColorBox();
            this.winningResult.hide();
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
