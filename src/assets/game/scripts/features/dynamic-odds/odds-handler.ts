import gc from "@sg/game-client-base";
import inversify from "inversify";
import { OddsStore } from "./odds-store";

const { injectable, inject } = inversify;

@injectable()
export class OddsHandler implements gc.Shared.IHandler<Record<string, number>> {
    @inject(OddsStore) private oddsStore: OddsStore;
    name = gc.Shared.GameServiceMessage.GameOdds.eventName;
    handle(input: Record<string, number>) {
        this.oddsStore.odds = input;
    }
}
