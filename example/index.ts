import DialogManager from '../dist/index.esm';

const dm = new DialogManager();

dm.set('dialogA', {
  onShow() {
    console.log('dialogA onShow');
  },
  async onHide(next) {
    console.log('dialogA onHide');

    next();
  },
});

dm.set('dialogB', {
  onShow() {
    console.log('dialogB onShow');

    dm.hide();
  },
  async onHide(next) {
    console.log('dialogB onHide');

    next();
  },
});

dm.set('dialogC', {
  onShow() {
    console.log('dialogC onShow');

    dm.hide();
  },
  async onHide(next) {
    console.log('dialogC onHide');

    next();
  },
});

dm.show('dialogA');

dm.show('dialogB');

dm.show('dialogC', undefined, {
  unshift: true,
});

setTimeout(() => {
  dm.hide();
}, 2000);
