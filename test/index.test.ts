import { describe, test } from '@jest/globals';

import DialogManager from '../dist/index.esm';

export const dm = new DialogManager();

describe('dialog show and hide', () => {
  dm.set('dialog', {
    onShow() {
      test('dialog show', () => {
        console.log('dialog onShow');
      });
    },
    async onHide() {
      test('dialog hide', () => {
        console.log('dialog onHide');
      });
    },
  });

  dm.show('dialog');
  dm.hide();

  dm.reset();
});
