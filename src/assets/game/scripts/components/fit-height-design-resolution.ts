import { _decorator, Component, screen, Size, sys, view } from "cc";
import { PREVIEW } from "cc/env";
import { FunctionUtils } from "db://shared-components/shared/utils/function-utils";
const { ccclass } = _decorator;
class FitHeightHandler {
    private designResolutionSize: Size;
    private timeout: NodeJS.Timeout;

    public init(): void {
        this.designResolutionSize = view.getDesignResolutionSize();
        this.adjustResolution();
        window.addEventListener("resize", this.debouncedResizeWindow);
    }

    private adjustResolution() {
        const { width, height } = this.designResolutionSize;
        if ((!sys.isMobile || FunctionUtils.isIpad()) && !PREVIEW) {
            const gameContainer = document.getElementById("Cocos3dGameContainer");
            gameContainer.style.position = "relative";
            // For desktop browsers, use FIT_HEIGHT
            const ratioScale = window.innerHeight / height;
            const newWidth = ratioScale * width;

            const dpr = screen.devicePixelRatio || 1;
            screen.windowSize = new Size(Math.round(newWidth * dpr), Math.round(window.innerHeight * dpr));
        }

        if (FunctionUtils.isIpad()) {
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;

            const gameDiv = document.getElementById('GameDiv')
            gameDiv.style['-webkit-transform'] = 'rotate(0deg)';
            gameDiv.style.transform = 'rotate(0deg)';
            gameDiv.style.margin = '0px auto';
            gameDiv.style.width = `${winWidth}px`;
            gameDiv.style.height = `${winHeight}px`;
        }
    }

    private debounce(func: any, wait: number) {
        return (...args: any[]) => {
            this.timeout && clearTimeout(this.timeout);
            this.timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    private resizeWindow() {
        this.adjustResolution();
    }

    private readonly debouncedResizeWindow = this.debounce(this.resizeWindow, 100);
}

@ccclass("FitHeightDesignResolution")
export class FitHeightDesignResolution extends Component {
    static handler: FitHeightHandler = null;

    onLoad(): void {
        if (FitHeightDesignResolution.handler) {
            return;
        }
        FitHeightDesignResolution.handler = new FitHeightHandler();
        FitHeightDesignResolution.handler.init();
    }
}
