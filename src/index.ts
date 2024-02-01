interface Config {
  laneCount?: number;
  onlyOne?: boolean;
  limit?: number;
}

interface Popup {
  name: string;
  targetLane: number;
  lane: Popup[];
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  forceShow: boolean;
  canResume: boolean;
  onHide: (next: () => void) => Promise<void>;
  cancel: () => void;
}

type OnePopup = Pick<Popup, 'name' | 'data' | 'onHide' | 'cancel'>;

interface OnShow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data: any, cancel: () => void): Popup['onHide'] | void;
}

function callCheckWrapper(fn: () => void, probe: { called: boolean }) {
  return () => {
    fn();

    probe.called = true;
  };
}

function isOnePopup(d: Popup | OnePopup, onlyOne: boolean): d is OnePopup {
  return onlyOne;
}

export default class PopupManager extends Map<
  Popup['name'],
  {
    onShow: OnShow;
    onHide: Popup['onHide'];
  }
> {
  constructor(config?: Config) {
    super();

    this.reset(config);
  }

  private laneCount: number;

  private lanes: Popup[][] | undefined;

  private onlyOne = false;

  private limit: number;

  private onePopup: OnePopup;
  private currentPopups?: Popup[] = [];

  private async next() {
    if (isOnePopup(this.onePopup, this.onlyOne)) {
      const onePopup = this.onePopup;

      if (onePopup) {
        const nPopup = this.get(onePopup.name);

        if (nPopup) {
          const onHide = nPopup.onShow(onePopup.data, onePopup.cancel);

          if (onHide) {
            onePopup.onHide = onHide;
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
      const nextPopup = currentLane.shift();

      if (nextPopup) {
        if (this.currentPopups.length < this.limit) {
          const { name, data } = nextPopup;

          const popup = this.get(name);

          if (popup) {
            this.currentPopups.push(nextPopup);

            const onHide = popup.onShow(data, nextPopup.cancel);

            if (onHide) {
              nextPopup.onHide = onHide;
            }
          } else {
            this.hide();
          }
        } else {
          const currentPopup = this.currentPopups[0];

          if (currentPopup) {
            if (
              (currentPopup.targetLane <= nextPopup.targetLane &&
                nextPopup.forceShow) ||
              (currentPopup.targetLane === nextPopup.targetLane &&
                currentPopup.index < nextPopup.index)
            ) {
              const nPopup = this.get(nextPopup.name);

              if (nPopup) {
                if (currentPopup.canResume) {
                  currentPopup.lane.unshift(currentPopup);
                }

                const next = () => {
                  this.currentPopups.push(nextPopup);

                  const onHide = nPopup.onShow(
                    nextPopup.data,
                    nextPopup.cancel,
                  );

                  if (onHide) {
                    nextPopup.onHide = onHide;
                  }
                };

                const probe = {
                  called: false,
                };

                await currentPopup.onHide(callCheckWrapper(next, probe));

                if (!probe.called) {
                  next();
                }
              }
            } else {
              nextPopup.lane.unshift(nextPopup);
            }
          }
        }
      }
    }
  }

  set(
    name: Popup['name'],
    {
      onShow,
      onHide,
    }: {
      onShow: OnShow;
      onHide: Popup['onHide'];
    },
  ) {
    if (super.has(name)) {
      throw new Error(`${name} already registered`);
    }

    super.set(name, { onShow, onHide });

    return this;
  }

  show(
    name: Popup['name'],
    data?: Popup['data'],
    config?: {
      targetLane?: number;
      forceShow?: boolean;
      canResume?: boolean;
      unshift?: boolean;
      index?: number;
    },
  ) {
    const popup = this.get(name);

    if (!popup) {
      throw new Error(`${name} not registered`);
    }

    if (this.onlyOne) {
      this.onePopup = {
        name,
        data,
        onHide: popup.onHide,
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

    const instance: Popup = {
      name,
      data,
      targetLane,
      lane,
      index: index ?? 0,
      forceShow: forceShow ?? false,
      canResume: canResume ?? true,
      onHide: popup.onHide,
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

  async hide(instance?: Popup | OnePopup) {
    instance = instance ?? this.onePopup ?? this.currentPopups.at(-1);

    if (instance) {
      if (isOnePopup(instance, this.onlyOne)) {
        if (this.onePopup === instance) {
          this.onePopup = undefined;

          const probe = {
            called: false,
          };

          await instance.onHide(callCheckWrapper(() => this.next(), probe));

          if (!probe.called) {
            this.next();
          }
        }
      } else {
        const currentInstance = instance as Popup;

        const index = this.currentPopups.indexOf(currentInstance);

        if (index >= 0) {
          this.currentPopups.splice(index, 1);

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

    this.onePopup = undefined;
    this.currentPopups = [];

    this.limit = config?.limit ?? this.limit ?? 1;
  }
}
