import PopupManager from '../dist/index.esm';

const dm = new PopupManager({
  limit: 2
});

dm.set('popupA', {
  onShow() {
    console.log('popupA onShow');
  },
  async onHide(next) {
    console.log('popupA onHide');

    next();
  },
});

dm.set('popupB', {
  onShow() {
    console.log('popupB onShow');

    dm.hide();
  },
  async onHide(next) {
    console.log('popupB onHide');

    next();
  },
});

dm.set('popupC', {
  onShow() {
    console.log('popupC onShow');

    dm.hide();
  },
  async onHide(next) {
    console.log('popupC onHide');

    next();
  },
});

dm.show('popupA');

dm.show('popupB');

dm.show('popupC', undefined, {
  unshift: true,
});

setTimeout(() => {
  dm.hide();
}, 2000);
