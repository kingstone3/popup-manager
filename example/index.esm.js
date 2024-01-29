var e = Object.defineProperty, n = (n2, t2, i2) => (((n3, t3, i3) => {
  t3 in n3 ? e(n3, t3, { enumerable: true, configurable: true, writable: true, value: i3 }) : n3[t3] = i3;
})(n2, "symbol" != typeof t2 ? t2 + "" : t2, i2), i2);
function t(e2, n2) {
  return () => {
    e2(), n2.called = true;
  };
}
class i extends Map {
  constructor(e2) {
    super(), n(this, "laneCount"), n(this, "lanes"), n(this, "onlyOne", false), n(this, "currentDialog"), this.laneCount = e2?.laneCount ?? 1, this.onlyOne = e2?.onlyOne ?? false, this.resetLanes();
  }
  resetLanes() {
    this.lanes = Array(this.laneCount).fill([]);
  }
  async next(e2) {
    if (this.currentDialog, this.onlyOne) {
      if (e2) {
        const n3 = this.get(e2.name);
        if (n3) {
          this.currentDialog = e2;
          const t2 = n3.onShow(e2.data, e2.cancel);
          t2 && (e2.onHide = t2);
        }
        return;
      }
      return;
    }
    const n2 = this.lanes?.findLast((e3) => e3.length > 0);
    if (n2) {
      const e3 = n2.shift();
      if (e3) {
        const n3 = this.currentDialog;
        if (n3)
          if (n3.targetLane <= e3.targetLane && e3.forceShow || n3.targetLane === e3.targetLane && n3.index < e3.index) {
            const i2 = this.get(e3.name);
            if (i2) {
              n3.canResume && n3.lane.unshift(n3);
              const s = () => {
                this.currentDialog = e3;
                const n4 = i2.onShow(e3.data, e3.cancel);
                n4 && (e3.onHide = n4);
              }, a = { called: false };
              await n3.onHide(t(s, a)), a.called || s();
            }
          } else
            e3.lane.unshift(e3);
        else {
          const { name: n4, data: t2 } = e3, i2 = this.get(n4);
          if (i2) {
            this.currentDialog = e3;
            const n5 = i2.onShow(t2, e3.cancel);
            n5 && (e3.onHide = n5);
          } else
            this.hide();
        }
      }
    }
  }
  set(e2, { onShow: n2, onHide: t2 }) {
    if (super.has(e2))
      throw new Error(`${e2} already registered`);
    return super.set(e2, { onShow: n2, onHide: t2 }), this;
  }
  show(e2, n2, t2) {
    let i2 = t2?.targetLane;
    const { forceShow: s, canResume: a, unshift: o, index: r } = t2 ?? {}, l = this.get(e2);
    if (!l)
      throw new Error(`${e2} not registered`);
    if (this.onlyOne)
      return void this.next({ name: e2, data: n2, onHide: l.onHide, cancel: () => {
        this.hide();
      } });
    if (!this.lanes)
      throw new Error("lanes not initialized");
    if (1 === this.lanes.length)
      i2 = 0;
    else if (!i2)
      throw new Error("targetLane is required in multi lane mode");
    const h = this.lanes[i2];
    if (!h)
      throw new Error("targetLane not found");
    const c = { name: e2, data: n2, targetLane: i2, lane: h, index: r ?? 0, forceShow: s ?? false, canResume: a ?? true, onHide: l.onHide, cancel: () => {
      if (this.currentDialog === c)
        this.hide();
      else {
        const e3 = c.lane.indexOf(c);
        e3 >= 0 && c.lane.splice(e3, 1);
      }
    } };
    return o ? h.unshift(c) : (h.push(c), h.sort((e3, n3) => n3.index - e3.index)), this.next(), c.cancel;
  }
  async hide() {
    const e2 = this.currentDialog;
    if (e2) {
      this.currentDialog = void 0;
      const n2 = { called: false };
      await e2.onHide(t(() => this.next(), n2)), n2.called || this.next();
    }
  }
  reset() {
    this.clear(), this.resetLanes(), this.currentDialog = void 0;
  }
}

const dm = new i();
dm.set("dialogA", {
  onShow() {
    console.log("dialogA onShow");
  },
  async onHide(next) {
    console.log("dialogA onHide");
    next();
  }
});
dm.set("dialogB", {
  onShow() {
    console.log("dialogB onShow");
  },
  async onHide(next) {
    console.log("dialogB onHide");
    next();
  }
});
dm.set("dialogC", {
  onShow() {
    console.log("dialogC onShow");
    dm.hide();
  },
  async onHide(next) {
    console.log("dialogC onHide");
    next();
  }
});
dm.show("dialogA");
dm.show("dialogB");
dm.show("dialogC", void 0, {
  unshift: true
});
setTimeout(() => {
  dm.hide();
}, 2e3);
