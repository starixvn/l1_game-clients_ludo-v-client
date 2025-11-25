import { _decorator, Node } from "cc";
import Observer from "observer";
import BetItem from "db://shared-components/game/bets/scripts/components/bet-item";
import { OddsStore, OddsWithConfig } from "../../features/dynamic-odds/odds-store";
import { AnimationUtils } from "db://shared-components/shared/utils";

const { property, ccclass } = _decorator;
const { render } = Observer;

@ccclass
export default class BetItemCustomize extends BetItem {
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

    @render(OddsStore, (store) => store.oddsWithConfig)
    renderIncreaseOdds(oddsWithConfig: OddsWithConfig) {
        const betChoice = this.betChoice;

        const { odds, deltaOdds } = oddsWithConfig;

        if (+odds[betChoice] <= 0) {
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
        AnimationUtils.setOpacityNode(this.increaseOdd, isIncrease ? 255 : 1);
        AnimationUtils.setOpacityNode(this.decreaseOdd, isIncrease ? 1 : 255);
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
}
