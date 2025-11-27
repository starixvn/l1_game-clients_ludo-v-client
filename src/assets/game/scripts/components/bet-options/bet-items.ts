import { _decorator, Widget } from "cc";
import { BetItemsPolygon as BetItemsPolygonBase } from "db://shared-components/game/bets/scripts/components/bet-items-polygon";
import observer from "observer";
import { OddsStore, OddsWithConfig } from "../../features/dynamic-odds/odds-store";
import BetItemCustomize from "./bet-item-customize";
import { GameBoardStore } from "../../features/game-board-state/game-board-store";
import { GameServiceMessage } from "../../features/game-messages";
import { ComponentUtils } from "db://shared-components/shared/utils";

const { ccclass, property } = _decorator;
const { render } = observer;

@ccclass
export class BetItems extends BetItemsPolygonBase {
    mappingColor = {
        0: "#BF9611",
        1: "#282E9A",
        2: "#9A2B28",
        3: "#189911",
    };

    /**
     * Update bet item background colors based on player index
     * @param playerIndex The player index to get color from mappingColor
     */
    private updateBetItemColors(playerIndex: number): void {
        if (playerIndex === undefined || playerIndex === null) {
            return;
        }

        const color = this.mappingColor[playerIndex];
        if (!color) {
            return;
        }

        this.betItemComponents.forEach((betItem) => {
            betItem.node.children.forEach((child) => {
                if (child.name === "bg") {
                    ComponentUtils.setNodeColor(child, color);
                }
            });
        });
    }

    @render(GameBoardStore, (store) => store.boardState)
    changeColorBetOptionsOnJoinGame(state: GameServiceMessage.BoardState) {
        if (state) {
            this.updateBetItemColors(state.nextPlayer);
        }
    }

    @render(GameBoardStore, (store) => store.nextState)
    changeColorBetOptionsOnNextState(state: GameServiceMessage.NextState) {
        if (state?.nextAction) {
            this.updateBetItemColors(state.nextAction.nextPlayer);
        }
    }

    @render(OddsStore, (store) => store.oddsWithConfig)
    renderOdds(oddsWithConfig: OddsWithConfig) {
        const { odds, fractional } = oddsWithConfig;
        Object.keys(odds || {}).forEach((choice) => {
            const betItem = this.filterBetItem(choice) as BetItemCustomize;
            if (!betItem) {
                return;
            }

            const odd = +odds[choice];
            if (odd <= 0) {
                betItem.blockBetOption();
                return;
            }

            betItem.updateStatusLabelOdds(true);
            betItem.renderIncreaseOdds(oddsWithConfig);
            betItem.renderOdd(odd, fractional);
        });
    }

    updateWidgets(betItem: BetItemCustomize) {
        const widgets = betItem.lblOdds?.getComponentsInChildren(Widget);
        if (widgets.length > 0) {
            widgets.forEach((widget) => {
                widget.updateAlignment();
            });
        }
    }

    handleResetHighlight(isResetHighlight: boolean) {}
}
