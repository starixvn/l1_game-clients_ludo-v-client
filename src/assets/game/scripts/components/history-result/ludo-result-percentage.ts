import gc from "@sg/game-client-base";
import { _decorator, Label } from "cc";
import { ObserverComponent } from "db://shared-components/shared/common-components/observer-component/scripts/observer-component";
import Observer from "observer";
const { ccclass, property } = _decorator;
const { render } = Observer;

export enum LudoBetType {
    big = "big",
    small = "small",
    odd = "odd",
    even = "even",
}

@ccclass
export class LudoResultPercentage extends ObserverComponent {
    @property(Label)
    lblBig: Label = null;

    @property(Label)
    lblSmall: Label = null;

    @property(Label)
    lblOdd: Label = null;

    @property(Label)
    lblEven: Label = null;

    @render(gc.RoundHistories.RoundHistoryStore, (store) => store.histories)
    renderResultPercentage(dataLogs: any[]) {
        this.calculatePercentagesMainChoice(dataLogs);
    }

    calculatePercentagesMainChoice(dataLogs: any[]) {
        if (dataLogs.length > 0) {
            let bigTotal = 0,
                smallTotal = 0,
                oddTotal = 0,
                evenTotal = 0;

            dataLogs.forEach((log) => {
                const { dice1, dice2 } = log.result;

                bigTotal += (dice1 + dice2) > 6 ? 1 : 0;
                smallTotal += (dice1 + dice2) < 7 ? 1 : 0;
                oddTotal += (dice1 + dice2) % 2 === 1 ? 1 : 0;
                evenTotal += (dice1 + dice2) % 2 === 0 ? 1 : 0;
            });

            const length = dataLogs.length;

            const bigPercentage = Math.round((bigTotal / length) * 100);
            const smallPercentage = Math.round((smallTotal / length) * 100);
            const oddPercentage = Math.round((oddTotal / length) * 100);
            const evenPercentage = Math.round((evenTotal / length) * 100);

            this.lblBig.string = `${bigPercentage}%`;
            this.lblSmall.string = `${smallPercentage}%`;
            this.lblOdd.string = `${oddPercentage}%`;
            this.lblEven.string = `${evenPercentage}%`;
        }
    }
}


