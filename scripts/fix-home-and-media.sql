UPDATE mongo_sitecontents
SET document = JSON_SET(
  JSON_REMOVE(
    CAST(document AS JSON),
    '$.data.showcase.items[12]',
    '$.data.showcase.items[5]'
  ),
  '$.data.seo.metaTitle', 'WTC Salt Lake',
  '$.data.seo.metaDescription', 'WTC Salt Lake is eastern India''s first World Trade Center — Grade-A office, retail and hospitality at Block-BP, Sector V, Salt Lake.'
),
updated_at = NOW(3)
WHERE JSON_UNQUOTE(JSON_EXTRACT(document, '$.key')) = 'home';

DELETE FROM mongo_mediaitems
WHERE JSON_UNQUOTE(JSON_EXTRACT(document, '$.slug')) IN (
  'pti-anantara-world-trade-centre-kolkata',
  'toi-minor-hotels-second-bengal-property',
  'hospitality-biz-anantara-kolkata-wtc',
  'rediff-anantara-hotel-kolkata-wtc'
);
