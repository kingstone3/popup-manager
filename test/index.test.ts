import { describe, test } from '@jest/globals';

import PopupManager from '../dist/index.esm';

export const dm = new PopupManager();

describe('popup show and hide', () => {
  dm.set('popup', {
    onShow() {
      test('popup show', () => {
        console.log('popup onShow');
      });
    },
    async onHide() {
      test('popup hide', () => {
        console.log('popup onHide');
      });
    },
  });

  dm.show('popup');
  dm.hide();

  dm.reset();
});
