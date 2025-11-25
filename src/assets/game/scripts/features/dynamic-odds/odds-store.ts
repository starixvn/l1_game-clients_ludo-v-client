import inversify from "inversify";
import mobx from "mobx";
import gc from "@sg/game-client-base";

const { injectable, inject } = inversify;

export type OddsWithConfig = {
    odds: Record<string, number>;
    fractional: boolean;
    deltaOdds: Record<string, number>;
};

@injectable()
export class OddsStore {
    @inject(gc.Player.MainPlayerStore) protected readonly mainPlayerStore: gc.Player.MainPlayerStore;
    @inject(gc.GameConfigs.GameConfigStore) protected readonly gameSetting: gc.GameConfigs.GameConfigStore;

    constructor() {
        mobx.makeAutoObservable(this);

        mobx.reaction(
            () => this.gameSetting?.odds,
            (odds) => {
                if (odds && Object.values(odds).length > 0) {
                    this.odds = odds;
                }
            }
        );
    }

    private readonly _odds: Array<Record<string, number>> = [];

    get odds() {
        return this._odds[this._odds.length - 1] || {};
    }

    set odds(odds: Record<string, number>) {
        this._odds.push(odds);

        if (this._odds.length > 2) {
            this._odds.shift();
        }
    }

    get oddsWithConfig(): OddsWithConfig {
        const deltaOdds = this._odds.length > 1 ? this.deltaForAllBetOptions(this._odds) : {};
        return {
            odds: this.odds,
            fractional: this.mainPlayerStore.fractionalOddsFormat,
            deltaOdds,
        };
    }

    deltaForAllBetOptions(odds: Array<Record<string, number>>) {
        const betOptionNames = [
            "big",
            "even",
            "goStable",
            "kick",
            "move",
            "noKick",
            "noMove",
            "noRelease",
            "noStable",
            "odd",
            "release",
            "small",
        ];
        const deltaOdds = {};
        for (const betOptionName of betOptionNames) {
            deltaOdds[betOptionName] = odds[odds.length - 1][betOptionName] - (odds[odds.length - 2][betOptionName] || 0);
        }
        return deltaOdds;
    }
}
