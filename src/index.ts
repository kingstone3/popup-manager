interface Config {
  laneCount?: number;
  onlyOne?: boolean;
  limit?: number;
}

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

function callCheckWrapper(fn: () => void, probe: { called: boolean }) {
  return () => {
    fn();

    probe.called = true;
  };
}

function isOneDialog(d: Dialog | OneDialog, onlyOne: boolean): d is OneDialog {
  return onlyOne;
}

export default class DialogManager extends Map<
  Dialog['name'],
  {
    onShow: OnShow;
    onHide: Dialog['onHide'];
  }
> {
  constructor(config?: Config) {
    super();

    this.reset(config);
  }

  private laneCount: number;

  private lanes: Dialog[][] | undefined;

  private onlyOne = false;

  private limit: number;

  private oneDialog: OneDialog;
  private currentDialogs?: Dialog[] = [];

  private async next() {
    if (currentDialogsIsOnlyOne(this.currentDialogs, this.onlyOne)) {
      if (oneDialog) {
        const nDialog = this.get(oneDialog.name);

        if (nDialog) {
          this.currentDialogs = oneDialog;

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
    config?: {
      targetLane?: number;
      forceShow?: boolean;
      canResume?: boolean;
      unshift?: boolean;
      index?: number;
    },
  ) {
    const dialog = this.get(name);

    if (!dialog) {
      throw new Error(`${name} not registered`);
    }

    if (this.onlyOne) {
      this.oneDialog = {
        name,
        data,
        onHide: dialog.onHide,
        cancel: () => {
          this.hide();
        },
      };

      this.next();

      return;
    }

    if (!this.lanes) {
      throw new Error('lanes not initialized');
    }

    const { forceShow, canResume, unshift, index } = config ?? {};
    let targetLane = config?.targetLane;

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
        this.hide(instance);
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

  async hide(instance?: Dialog | OneDialog) {
    instance = instance ?? this.oneDialog ?? this.currentDialogs.shift();

    if (instance) {
      if (isOneDialog(instance, this.onlyOne)) {
        if (this.oneDialog === instance) {
          this.oneDialog = undefined;

          const probe = {
            called: false,
          };

          await instance.onHide(callCheckWrapper(() => this.next(), probe));

          if (!probe.called) {
            this.next();
          }
        }
      } else {
        const currentInstance = instance as Dialog;

        const index = this.currentDialogs.indexOf(currentInstance);

        if (index >= 0) {
          this.currentDialogs.splice(index, 1);

          const probe = {
            called: false,
          };

          await currentInstance.onHide(
            callCheckWrapper(() => this.next(), probe),
          );

          if (!probe.called) {
            this.next();
          }
        } else {
          const index = currentInstance.lane.indexOf(instance);

          if (index >= 0) {
            currentInstance.lane.splice(index, 1);
          }
        }
      }
    }
  }

  reset(config?: Config) {
    this.clear();

    this.laneCount = config?.laneCount ?? this.laneCount ?? 1;
    this.lanes = Array(this.laneCount).fill([]);

    this.onlyOne = config?.onlyOne ?? this.onlyOne ?? false;

    this.oneDialog = undefined;
    this.currentDialogs = [];

    this.limit = config?.limit ?? this.limit ?? 1;
  }
}
