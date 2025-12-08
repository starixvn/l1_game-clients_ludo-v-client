import { _decorator, Sprite, tween, UITransform, Vec3 } from 'cc';
import Observer from "observer";
import { ObserverComponent } from "db://shared-components/shared/common-components/observer-component/scripts/observer-component";
import { GameBoardStore } from "./features/game-board-state/game-board-store";
import { GameServiceMessage } from "./features/game-messages";
import mobx from "mobx";

const { render } = Observer;
const { property, ccclass } = _decorator;

@ccclass
export default class ProgressBar extends ObserverComponent {
    @property([Sprite])
    progressNodes: Sprite[] = [];

    @property(Sprite)
    progressBarBgNode: Sprite = null;

    interval: any = null;

    public progressWidths: [number, number, number] = [0, 0, 0];

    private progressTweens: any[] = [];
    private readonly gameSpeed: number = 10;
    private readonly averageTotalTurns: number = 415;
    private maxProgressWidth: number = 762;

    updateProgressBar(progress: number) {
        if (progress >= 0 && progress <= this.maxProgressWidth) {
            tween(this.progressBarBgNode.node.getComponent(UITransform)).to(1, { width: progress }, { easing: 'linear' }).start();
        }
    }

    initProgressBar() {
        let accumulatedWidth = 0;
        this.progressNodes.forEach((node, index) => {
            this.progressWidths[index] = node.getComponent(UITransform).width;
            node.node.setPosition(new Vec3(accumulatedWidth, 0, 0));
            accumulatedWidth += this.progressWidths[index];
        });

        this.maxProgressWidth = this.progressBarBgNode.node.getComponent(UITransform).width;
    }

    startProgressBarAnimation() {
        this.stopProgressBarAnimation();

        const totalWidth = this.progressWidths.reduce((sum, width) => sum + width, 0);
        
        const calculateDuration = (width: number) => width / this.gameSpeed;

        const createProgressTween = (progressNode: Sprite, nodeWidth: number, index: number) => {
            const duration = calculateDuration(nodeWidth);
            const currentPos = progressNode.node.position.clone();
            
            const targetX = currentPos.x - nodeWidth;
            
            const tweenAction = tween(progressNode.node)
                .to(duration, { position: new Vec3(targetX, currentPos.y, currentPos.z) }, { easing: 'linear' })
                .call(() => {
                    const newPos = progressNode.node.position;
                    
                    if (newPos.x <= -nodeWidth) {
                        const resetX = totalWidth - nodeWidth;
                        progressNode.node.setPosition(new Vec3(resetX, newPos.y, newPos.z));
                    }

                    this.progressTweens[index] = createProgressTween(progressNode, nodeWidth, index);
                })
                .start();
            
            return tweenAction;
        };

        this.progressNodes.forEach((node, index) => {
            this.progressTweens[index] = createProgressTween(node, this.progressWidths[index], index);
        });
    }

    stopProgressBarAnimation() {
        this.progressTweens.forEach(tweenAction => {
            if (tweenAction) {
                tweenAction.stop();
            }
        });
        this.progressTweens = [];
    }

    @render(GameBoardStore, (store) => store.nextState)
    renderProgressBar(nextState: GameServiceMessage.NextState) {
        if (!nextState) {
            return;
        }

        const nextStateJS = mobx.toJS(nextState);

        const currentTurnCount = nextStateJS.currentTurnCount;
        const percentage = this.calculatePercentage(currentTurnCount);
        this.updateProgressBar(percentage);
    }

    @render(GameBoardStore, (store) => store.boardState)
    renderProgressBarOnJoinGame(state: GameServiceMessage.BoardState) {
        if (state) {
            const percentage = this.calculatePercentage(state.currentTurnCount);
            this.updateProgressBar(percentage);
        }
    }

    calculatePercentage(currentTurnCount: number) {
        let percentage = (currentTurnCount / this.averageTotalTurns) * 100;
        if (percentage > 100) {
            percentage = 99;
        }

        return this.maxProgressWidth - (percentage / 100) * this.maxProgressWidth;
    }

    onLoad() {
        super.onLoad();
        this.initProgressBar();
        this.startProgressBarAnimation();
    }

    onDestroy() {
        clearInterval(this.interval);
        this.stopProgressBarAnimation();
    }
}


