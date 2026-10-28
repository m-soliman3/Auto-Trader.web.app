import { LISTED_EXCHANGES } from '../../services/exchange.service';
import { LEARN_PAGES } from '../learn/learn-detail';
import { BROKER_GUIDES } from './broker-guides';
import { BROKER_PAGES, brokerExchange } from './broker-pages';

describe('broker pages', () => {
  const liveIds = LISTED_EXCHANGES.filter((e) => !e.isPaper).map((e) => e.id);
  const pageSlugs = BROKER_PAGES.map((p) => p.slug);

  it('has exactly one page per live exchange', () => {
    expect([...pageSlugs].sort()).toEqual([...liveIds].sort());
  });

  it('links each page to a real paper variant', () => {
    for (const page of BROKER_PAGES.filter((p) => p.paperId)) {
      expect(brokerExchange(page.paperId!)?.isPaper, page.slug).toBe(true);
    }
  });

  it('has a guide for every page, linking only to existing learn pages', () => {
    expect(Object.keys(BROKER_GUIDES).sort()).toEqual([...pageSlugs].sort());
    for (const [slug, guide] of Object.entries(BROKER_GUIDES)) {
      for (const strategy of guide.strategies) {
        const learn = LEARN_PAGES[strategy.slug];
        expect(learn, `${slug} → ${strategy.slug}`).toBeDefined();
        expect(learn?.category, `${slug} → ${strategy.slug}`).not.toBe('blog');
      }
    }
  });

});
