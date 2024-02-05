import { callCheckWrapper, isNoCache } from './utils';

interface Config {
  laneCount?: number;
  noCache?: boolean;
  limit?: number;
}

export interface Popup {
  name: string;
  targetLane: number;
  lane: Popup[];
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  forceShow: boolean;
  resumable: boolean;
  onHide: (next: () => void) => Promise<void>;
  cancel: () => void;
}

export type NoCachePopup = Pick<Popup, 'name' | 'data' | 'onHide' | 'cancel'>;

interface OnShow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (data: any, cancel: () => void): Popup['onHide'] | void;
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

  private noCache = false;

  private limit: number;

  private noCachePopup: NoCachePopup;
  private currentPopups: Popup[] = [];

  private async next() {
    if (this.noCache) {
      const noCachePopup = this.noCachePopup;

      if (noCachePopup) {
        const nPopup = this.get(noCachePopup.name);

        if (nPopup) {
          const onHide = nPopup.onShow(noCachePopup.data, noCachePopup.cancel);

          if (onHide) {
            noCachePopup.onHide = onHide;
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
                if (currentPopup.resumable) {
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
      resumable?: boolean;
      unshift?: boolean;
      index?: number;
    },
  ) {
    const popup = this.get(name);

    if (!popup) {
      throw new Error(`${name} not registered`);
    }

    if (this.noCache) {
      this.noCachePopup = {
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

    const { forceShow, resumable, unshift, index } = config ?? {};
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
      forceShow: forceShow ?? this.limit !== 1,
      resumable: resumable ?? this.limit === 1,
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

  async hide(instance?: Popup | NoCachePopup) {
    const currentInstance =
      instance ?? this.noCachePopup ?? this.currentPopups.at(0);

    if (currentInstance) {
      if (isNoCache(currentInstance, this.noCache)) {
        if (this.noCachePopup === currentInstance) {
          this.noCachePopup = undefined;

          const probe = {
            called: false,
          };

          await currentInstance.onHide(
            callCheckWrapper(() => this.next(), probe),
          );

          if (!probe.called) {
            this.next();
          }
        }
      } else {
        const _currentInstance = currentInstance as Popup;

        const index = this.currentPopups.indexOf(_currentInstance);

        if (index >= 0) {
          this.currentPopups.splice(index, 1);

          const probe = {
            called: false,
          };

          await _currentInstance.onHide(
            callCheckWrapper(() => this.next(), probe),
          );

          if (!probe.called) {
            this.next();
          }
        } else {
          const index = _currentInstance.lane.indexOf(_currentInstance);

          if (index >= 0) {
            _currentInstance.lane.splice(index, 1);
          }
        }
      }
    }
  }

  reset(config?: Config) {
    this.clear();

    this.laneCount = config?.laneCount ?? this.laneCount ?? 1;
    this.lanes = Array(this.laneCount).fill([]);

    this.noCache = config?.noCache ?? this.noCache ?? false;

    this.noCachePopup = undefined;
    this.currentPopups = [];

    this.limit = config?.limit ?? this.limit ?? 1;
  }
}
