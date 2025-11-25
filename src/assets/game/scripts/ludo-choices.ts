export enum BetChoice {
    BIG = "big",
    EVEN = "even",
    GO_STABLE = "goStable",
    KICK = "kick",
    MOVE = "move",
    NO_KICK = "noKick",
    NO_MOVE = "noMove",
    NO_RELEASE = "noRelease",
    NO_STABLE = "noStable",
    ODD = "odd",
    RELEASE = "release",
    SMALL = "small",
}

export interface ILudoSettlementResult {
    big: boolean;
    even: boolean;
    goStable: boolean;
    kick: boolean;
    move: boolean;
    noKick: boolean;
    noMove: boolean;
    noRelease: boolean;
    noStable: boolean;
    odd: boolean;
    release: boolean;
    small: boolean;
}

export interface ILudoSettlement {
    result: ILudoResult;
    settlementResult: ILudoSettlementResult;
    roundId: number;
}

export interface ILudoResult {
    action: any;
    board: any;
    currentPlayers: [];
    dice1: number;
    dice2: number;
    nextTurnIndex: number;
    winner: [];
}
