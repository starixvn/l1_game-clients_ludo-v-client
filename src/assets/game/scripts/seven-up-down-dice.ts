import { _decorator, Component, Sprite, SpriteFrame, Tween, Node, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

@ccclass
export class SevenUpDownDice extends Component {
    @property(Sprite)
    diceSprite: Sprite | null = null;

    private diceAnimation: Tween<Node> | null = null;

    onLoad() {
        this.setOpacity(0);
    }

    setOpacity(opacity: number) {
        if (this.diceSprite?.node) {
            let uiOpacity = this.diceSprite.node.getComponent(UIOpacity);
            if (!uiOpacity) {
                uiOpacity = this.diceSprite.node.addComponent(UIOpacity);
            }
            uiOpacity.opacity = opacity;
        }
    }

    setFrame(spriteFrame: SpriteFrame) {
        this.setOpacity(255);
        if (this.diceSprite) {
            this.diceSprite.spriteFrame = spriteFrame;
        }
    }

    stopAnimation() {
        if (this.diceAnimation) {
            this.diceAnimation.stop();
            this.diceAnimation = null;
        }
    }

    runAnimation(resultDiceFrames: SpriteFrame[], duration: number) {
        if (!this.diceSprite) 
        {
            return;
        }
        
        let index = 0;
        const diceFramesNumber = resultDiceFrames.length;

        this.diceAnimation = new Tween(this.diceSprite.node)
            .repeat(
                diceFramesNumber,
                new Tween()
                    .delay(duration / diceFramesNumber)
                    .call(() => {
                        this.setFrame(resultDiceFrames[index]);
                        index++;
                    })
            )
            .start();
    }
}
