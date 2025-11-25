import inversify from "inversify";
import mobx from "mobx";

import { GameServiceMessage } from "../game-messages";

const { injectable } = inversify;
const { makeAutoObservable } = mobx;

@injectable()
export class GameBoardStore {
    private _boardState: GameServiceMessage.BoardState | null = null;

    get boardState(): GameServiceMessage.BoardState | null {
        return this._boardState;
    }

    set boardState(boardState: GameServiceMessage.BoardState | null) {
        this._boardState = boardState;
    }

    constructor() {
        makeAutoObservable(this);
    }
}
