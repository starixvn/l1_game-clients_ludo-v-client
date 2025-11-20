import gc from "@sg/game-client-base";
import { _decorator, Color, Node, Sprite, tween, v3 } from "cc";
import { WinningResult } from "../../../../extensions/shared-components/assets/shared/common-components/winning-result/scripts/winning-result";
import { AnimationUtils } from "../../../../extensions/shared-components/assets/shared/utils/utils";
const { ccclass, property } = _decorator;

@ccclass("ColorGameWinningResult")
export class ColorGameWinningResult extends WinningResult {
    @property(Node)
    colors: Node[] = [];

    protected delayTimeShowWinning = 2;
    protected durationTimeShowWinning = 5;

    showQuickly() {
        this.node.scale = v3(1, 1, 1);
        this.node.active = true;
    }
    show(duration = 0.3) {
        return new Promise((resolve) => {
            this.node.scale = v3(0, 0, 0);
            this.node.active = true;
            tween(this.node)
                .call(() => {
                    AnimationUtils.fadeIn(this.node, 0.4 * duration);
                })
                .to(
                    duration,
                    {
                        scale: v3(1.05, 1.05, 1.05),
                    },
                    { easing: "sineOut" }
                )
                .to(
                    0.1,
                    {
                        scale: v3(1, 1, 1),
                    },
                    { easing: "sineOut" }
                )

                .call(resolve)
                .start();
        });
    }

    setResult(data: gc.GameServiceMessage.TResult) {
        const results = Object.values(data);

        this.colors.forEach((color, index) => {
            const result = results[index];
            const ctx = color.getComponent(Sprite);
            ctx.color = new Color().fromHEX("#168cc9");
        });
    }
}
