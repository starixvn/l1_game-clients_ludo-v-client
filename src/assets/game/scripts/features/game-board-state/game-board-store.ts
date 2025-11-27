import inversify from "inversify";
import mobx from "mobx";

import { GameServiceMessage } from "../game-messages";

const { injectable } = inversify;
const { makeAutoObservable } = mobx;

@injectable()
export class GameBoardStore {
    private _boardState: GameServiceMessage.BoardState | null = null;
    private _finishBoardState: GameServiceMessage.FinishBoardState | null = null;
    private _nextState: GameServiceMessage.NextState | null = null;

    get boardState(): GameServiceMessage.BoardState | null {
        return this._boardState;
    }

    set boardState(boardState: GameServiceMessage.BoardState | null) {
        this._boardState = boardState;
    }

    get finishBoardState(): GameServiceMessage.FinishBoardState | null {
        return this._finishBoardState;
    }

    set finishBoardState(finishBoardState: GameServiceMessage.FinishBoardState | null) {
        this._finishBoardState = finishBoardState;
    }

    get nextState(): GameServiceMessage.NextState | null {
        return this._nextState;
    }

    set nextState(nextState: GameServiceMessage.NextState | null) {
        this._nextState = nextState;
    }

    constructor() {
        makeAutoObservable(this);
    }
}
