-- Seed data: popular board games (sourced from BGG)
INSERT INTO games (bgg_id, title, min_players, max_players, playtime_mins, image_url, categories)
VALUES
  (13,     'Catan',                           3, 4, 90,  'https://cf.geekdo-images.com/W3Bsga_uLP9kO91gZ7H8yw__original/img/M_3Vg1j2HsGEBJBO7Bs_dMgbOSI=/0x0/filters:format(jpeg)/pic2419375.jpg', ARRAY['Strategy', 'Negotiation']),
  (9209,   'Ticket to Ride',                  2, 5, 75,  'https://cf.geekdo-images.com/ZWJg0dCdrWHspVJym5xPIw__original/img/EuhiRSbTFGkABFk8bMldHRMdHb4=/0x0/filters:format(jpeg)/pic38668.jpg',     ARRAY['Strategy', 'Family']),
  (30549,  'Pandemic',                        2, 4, 45,  'https://cf.geekdo-images.com/S3ybV1LAp-8wen9AAIr5eQ__original/img/843GIyb3LwZg3TVzXH7v7VzNAEI=/0x0/filters:format(jpeg)/pic1534148.jpg',  ARRAY['Cooperative', 'Strategy']),
  (822,    'Carcassonne',                     2, 5, 45,  'https://cf.geekdo-images.com/okJAB5IPd0TnfsDKnXMaYQ__original/img/kEb5K8A4wjJoqFDvS6_PHsWAEps=/0x0/filters:format(jpeg)/pic2337577.jpg',  ARRAY['Strategy', 'Family']),
  (68448,  '7 Wonders',                       2, 7, 30,  'https://cf.geekdo-images.com/RvFVTEpnbb4NM7k0IF8V7A__original/img/oN3XHArTVPkv6bCiHXLQDHZmDRM=/0x0/filters:format(jpeg)/pic860217.jpg',    ARRAY['Strategy', 'Card Game']),
  (178900, 'Codenames',                       2, 8, 15,  'https://cf.geekdo-images.com/F_KDEu0GjdClml8N7c8Imw__original/img/sS53FVGVzn6yBQJfXnmVFWEHFkE=/0x0/filters:format(jpeg)/pic2582929.jpg',  ARRAY['Party', 'Word Game']),
  (266192, 'Wingspan',                        1, 5, 70,  'https://cf.geekdo-images.com/yLZJCVLlIx4c7eJEWUNJ7w__original/img/lJQFJEQ2mRBGCRkS9C3QLHNKBEQ=/0x0/filters:format(jpeg)/pic4458123.jpg',  ARRAY['Strategy', 'Engine Building']),
  (230802, 'Azul',                            2, 4, 45,  'https://cf.geekdo-images.com/aPSHJO0d0XOpQR5X-wJonw__original/img/fKJO1Y7MKUxNxEUMNfXTuAhJRDI=/0x0/filters:format(jpeg)/pic3718275.jpg',   ARRAY['Abstract', 'Strategy']),
  (148228, 'Splendor',                        2, 4, 30,  'https://cf.geekdo-images.com/rwOMxx3q5yueel14eBL25g__original/img/ye98pMPMBMf7QnTKMnbNbaMHquE=/0x0/filters:format(jpeg)/pic1904079.jpg',  ARRAY['Strategy', 'Card Game']),
  (36218,  'Dominion',                        2, 4, 30,  'https://cf.geekdo-images.com/j4pBGCZCEMCPBMEB_dxRmA__original/img/GKiSkGFBQEaXP1L4AJOTL_APJNE=/0x0/filters:format(jpeg)/pic394356.jpg',   ARRAY['Deck Building', 'Card Game']),
  (167791, 'Terraforming Mars',               1, 5, 120, 'https://cf.geekdo-images.com/wg9oOLcsKvDesSUdZQ4rxw__original/img/BTi1SKPD3gDiNDzaEEhbqoOHlRI=/0x0/filters:format(jpeg)/pic3536616.jpg',  ARRAY['Strategy', 'Engine Building']),
  (174430, 'Gloomhaven',                      1, 4, 120, 'https://cf.geekdo-images.com/sZYp_3im3YqpRIveXW5qIw__original/img/LDlHPZQESjwnkDyMHbJYmS40YJQ=/0x0/filters:format(jpeg)/pic2437871.jpg',  ARRAY['Cooperative', 'Dungeon Crawler']),
  (237182, 'Root',                            2, 4, 90,  'https://cf.geekdo-images.com/JUAUWaVUzeBgzirhZNmHHw__original/img/y4RHDU0hHmJH9gSrPWKpkxq3Jjo=/0x0/filters:format(jpeg)/pic4254509.jpg',   ARRAY['Strategy', 'Asymmetric']),
  (199792, 'Everdell',                        1, 4, 80,  'https://cf.geekdo-images.com/bdxPNSAGZFqaHzZZKLBubA__original/img/bLHaK3bqRiS6Kn7BNPK2BrN7VY=/0x0/filters:format(jpeg)/pic3918905.jpg',  ARRAY['Strategy', 'Worker Placement']),
  (169786, 'Scythe',                          1, 5, 115, 'https://cf.geekdo-images.com/7k_nOxpO9OGIjhLq2BvynA__original/img/Kov0B6sSEFo_TBBi1rqO2OKBZzI=/0x0/filters:format(jpeg)/pic3163924.jpg',  ARRAY['Strategy', 'Engine Building']),
  (342942, 'Cascadia',                        1, 4, 45,  'https://cf.geekdo-images.com/MjeJZfulbsM1DSV3DrGJYA__original/img/gKHJmHqHQaKQTckWnVsAWAcVFl4=/0x0/filters:format(jpeg)/pic6094080.jpg', ARRAY['Strategy', 'Tile Placement']),
  (316554, 'Dune: Imperium',                  1, 4, 120, 'https://cf.geekdo-images.com/PhjygpWSo-0labGrPBMyyg__original/img/TkLAAlrJXrRZYkGEiKkh4JpfRFM=/0x0/filters:format(jpeg)/pic5666597.jpg',  ARRAY['Strategy', 'Worker Placement']),
  (220308, 'Gaia Project',                    1, 4, 150, 'https://cf.geekdo-images.com/hGWFm3hbMlCDsfCsauOQ4g__original/img/m7jTjouEQS6WPmGdTMbvECFtGAs=/0x0/filters:format(jpeg)/pic3727516.jpg',  ARRAY['Strategy', 'Science Fiction']),
  (12333,  'Twilight Imperium: Fourth Edition', 3, 6, 480, 'https://cf.geekdo-images.com/ig3H0lv3IuGqJSMuZhBKbA__original/img/vUXxQGqUEwnxjzHrHGEFjCXUuoU=/0x0/filters:format(jpeg)/pic3727516.jpg', ARRAY['Strategy', 'Space'])
ON CONFLICT (bgg_id) DO NOTHING;
