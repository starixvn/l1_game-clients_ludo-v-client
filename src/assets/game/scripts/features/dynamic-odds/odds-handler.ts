import gc from "@sg/game-client-base";
import inversify from "inversify";
import { OddsStore } from "./odds-store";

const { injectable, inject } = inversify;

@injectable()
export class OddsHandler implements gc.Shared.IHandler<Record<string, number>> {
    @inject(OddsStore) private readonly oddsStore: OddsStore;
    name = "nextState";
    handle(input: any) {
        this.oddsStore.odds = input.odds;
    }
}
