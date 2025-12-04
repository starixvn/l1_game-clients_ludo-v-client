import { _decorator, Node } from "cc";
import BetItem from "db://shared-components/game/bets/scripts/components/bet-item";
import { OddsWithConfig } from "../../features/dynamic-odds/odds-store";
import { AnimationUtils } from "db://shared-components/shared/utils";

const { property, ccclass } = _decorator;

@ccclass
export default class BetItemCustomize extends BetItem {

    @property([Node])
    bgNodes: Node[] = [];

    @property(Node)
    increaseOdd: Node = null;

    @property(Node)
    decreaseOdd: Node = null;

    @property(Node)
    disableNode: Node = null;

    @property(Node)
    blockIcon: Node = null;

    onLoad(): void {
        this.setBlockIconVisibility(false);
        this.hideOddsIndicators();
        super.onLoad();
    }

    renderIncreaseOdds(oddsWithConfig: OddsWithConfig) {
        const betChoice = this.betChoice;

        const { odds, deltaOdds } = oddsWithConfig;

        if (+odds[betChoice] <= 0 || Object.keys(deltaOdds).length === 0) {
            return;
        }

        const deltaOdd = deltaOdds[betChoice] || 0;
        this.updateOddsIndicators(deltaOdd);
    }

    private hideOddsIndicators(): void {
        AnimationUtils.setOpacityNode(this.increaseOdd, 1);
        AnimationUtils.setOpacityNode(this.decreaseOdd, 1);
    }

    private updateOddsIndicators(deltaOdd: number): void {
        const isIncrease = deltaOdd > 0;

        if (deltaOdd === 0) {
            this.hideOddsIndicators();
        } else {
            AnimationUtils.setOpacityNode(this.increaseOdd, isIncrease ? 255 : 50);
            AnimationUtils.setOpacityNode(this.decreaseOdd, isIncrease ? 50 : 255);
        }
        this.setBlockIconVisibility(false);
        this.setDisabledVisibility(false);
    }

    setDisabledVisibility(status: boolean) {
        this.disableNode && (this.disableNode.active = status);
    }

    setBlockIconVisibility(status: boolean) {
        this.blockIcon && (this.blockIcon.active = status);
    }

    blockBetOption() {
        this.setBlockIconVisibility(true);
        this.setDisabledVisibility(true);
        this.hideOddsIndicators();
        this.updateStatusLabelOdds(false);
    }

    updateStatusLabelOdds(status: boolean) {
        this.lblOdds.node.active = status;
    }

    updateBetItemColors(playerIndex: number) {
        if (playerIndex === undefined || playerIndex === null) {
            return;
        }

        //enable node bg at index playerIndex, disable other nodes
        this.bgNodes.forEach((node, index) => {
            node.active = index === playerIndex;
        });
    }
}
