import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SearchCatalogUseCase } from '../../src/catalog/application/search-catalog.use-case';
import { PriceFilterNotAllowedError } from '../../src/catalog/domain/catalog.errors';
import { CatalogReader } from '../../src/catalog/domain/catalog-reader.port';

const BUYER_ID = 'c0000000-0000-0000-0000-000000000001';
const BASE_QUERY = { limit: 20, offset: 0 };

/** Records which read methods were called, so tests can assert the privacy routing. */
function recordingReader(): { reader: CatalogReader; calls: string[] } {
  const calls: string[] = [];
  const reader: CatalogReader = {
    searchPublic: async () => {
      calls.push('public');
      return [];
    },
    searchPriced: async (level) => {
      calls.push(`priced:${level}`);
      return [];
    },
  };
  return { reader, calls };
}

describe('SearchCatalogUseCase: privacy wall', () => {
  it('a guest reads only the public query, never the priced one', async () => {
    const { reader, calls } = recordingReader();

    await new SearchCatalogUseCase(reader).execute({ kind: 'guest' }, BASE_QUERY);

    assert.deepEqual(calls, ['public']);
  });

  it('a guest cannot filter by price, and no data is read', async () => {
    const { reader, calls } = recordingReader();

    await assert.rejects(
      new SearchCatalogUseCase(reader).execute(
        { kind: 'guest' },
        { ...BASE_QUERY, minPriceCents: 100 },
      ),
      PriceFilterNotAllowedError,
    );

    assert.deepEqual(calls, []);
  });

  it('a buyer reads prices only for his own level', async () => {
    const { reader, calls } = recordingReader();

    await new SearchCatalogUseCase(reader).execute(
      { kind: 'buyer', buyerId: BUYER_ID, role: 'NIVEL_1_MAYORISTA' },
      BASE_QUERY,
    );

    assert.deepEqual(calls, ['priced:NIVEL_1_MAYORISTA']);
  });
});
