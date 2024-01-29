interface Dialog {
  name: string;
  targetLane: number;
  lane: Dialog[];
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  forceShow: boolean;
  canResume: boolean;
  onHide: (next: () => void) => Promise<void>;
  cancel: () => void;
}

type OneDialog = Pick<Dialog, 'name' | 'data' | 'onHide' | 'cancel'>;

interface OnShow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data: any, cancel: () => void): Dialog['onHide'] | void;
}

function isMultiDialogMode(
  d: DialogManager['currentDialog'],
  onlyOne: boolean,
): d is Dialog {
  return !onlyOne;
}

function callCheckWrapper(fn: () => void, probe: { called: boolean }) {
  return () => {
    fn();

    probe.called = true;
  };
}

export default class DialogManager extends Map<
  Dialog['name'],
  {
    onShow: OnShow;
    onHide: Dialog['onHide'];
  }
> {
  constructor(config?: { laneCount?: number; onlyOne?: boolean }) {
    super();

    this.laneCount = config?.laneCount ?? 1;

    this.onlyOne = config?.onlyOne ?? false;

    this.resetLanes();
  }

  private laneCount: number;

  private lanes: Dialog[][] | undefined;

  private onlyOne = false;

  private currentDialog?: Dialog | OneDialog;

  private resetLanes() {
    this.lanes = Array(this.laneCount).fill([]);
  }

  private async next(oneDialog?: OneDialog) {
    if (!isMultiDialogMode(this.currentDialog, this.onlyOne)) {
      if (oneDialog) {
        const nDialog = this.get(oneDialog.name);

        if (nDialog) {
          this.currentDialog = oneDialog;

          const onHide = nDialog.onShow(oneDialog.data, oneDialog.cancel);

          if (onHide) {
            oneDialog.onHide = onHide;
          }
        }

        return;
      }

      return;
    }

    const currentLane = this.lanes?.findLast((lane) => {
      return lane.length > 0;
    });

    if (currentLane) {
      const nextDialog = currentLane.shift();

      if (nextDialog) {
        const currentDialog = this.currentDialog;

        if (currentDialog) {
          if (
            (currentDialog.targetLane <= nextDialog.targetLane &&
              nextDialog.forceShow) ||
            (currentDialog.targetLane === nextDialog.targetLane &&
              currentDialog.index < nextDialog.index)
          ) {
            const nDialog = this.get(nextDialog.name);

            if (nDialog) {
              if (currentDialog.canResume) {
                currentDialog.lane.unshift(currentDialog);
              }

              const next = () => {
                this.currentDialog = nextDialog;

                const onHide = nDialog.onShow(
                  nextDialog.data,
                  nextDialog.cancel,
                );

                if (onHide) {
                  nextDialog.onHide = onHide;
                }
              };

              const probe = {
                called: false,
              };

              await currentDialog.onHide(callCheckWrapper(next, probe));

              if (!probe.called) {
                next();
              }
            }
          } else {
            nextDialog.lane.unshift(nextDialog);
          }
        } else {
          const { name, data } = nextDialog;

          const dialog = this.get(name);

          if (dialog) {
            this.currentDialog = nextDialog;

            const onHide = dialog.onShow(data, nextDialog.cancel);

            if (onHide) {
              nextDialog.onHide = onHide;
            }
          } else {
            this.hide();
          }
        }
      }
    }
  }

  set(
    name: Dialog['name'],
    {
      onShow,
      onHide,
    }: {
      onShow: OnShow;
      onHide: Dialog['onHide'];
    },
  ) {
    if (super.has(name)) {
      throw new Error(`${name} already registered`);
    }

    super.set(name, { onShow, onHide });

    return this;
  }

  show(
    name: Dialog['name'],
    data?: Dialog['data'],
    {
      targetLane,
      forceShow,
      canResume,
      unshift,
      index,
    }: {
      targetLane?: number;
      forceShow?: boolean;
      canResume?: boolean;
      unshift?: boolean;
      index?: number;
    } = {},
  ) {
    const dialog = this.get(name);

    if (!dialog) {
      throw new Error(`${name} not registered`);
    }

    if (this.onlyOne) {
      this.next({
        name,
        data,
        onHide: dialog.onHide,
        cancel: () => {
          this.hide();
        },
      });

      return;
    }

    if (!this.lanes) {
      throw new Error('lanes not initialized');
    }

    if (this.lanes.length === 1) {
      targetLane = 0;
    } else if (!targetLane) {
      throw new Error('targetLane is required in multi lane mode');
    }

    const lane = this.lanes[targetLane];

    if (!lane) {
      throw new Error('targetLane not found');
    }

    const instance: Dialog = {
      name,
      data,
      targetLane,
      lane,
      index: index ?? 0,
      forceShow: forceShow ?? false,
      canResume: canResume ?? true,
      onHide: dialog.onHide,
      cancel: () => {
        if (this.currentDialog === instance) {
          this.hide();
        } else {
          const index = instance.lane.indexOf(instance);

          if (index >= 0) {
            instance.lane.splice(index, 1);
          }
        }
      },
    };

    if (unshift) {
      lane.unshift(instance);
    } else {
      lane.push(instance);

      lane.sort((a, b) => b.index - a.index);
    }

    this.next();

    return instance.cancel;
  }

  async hide() {
    const currentDialog = this.currentDialog;

    if (currentDialog) {
      this.currentDialog = undefined;

      const probe = {
        called: false,
      };

      await currentDialog.onHide(callCheckWrapper(() => this.next(), probe));

      if (!probe.called) {
        this.next();
      }
    }
  }

  reset() {
    this.clear();

    this.resetLanes();

    this.currentDialog = undefined;
  }
}
