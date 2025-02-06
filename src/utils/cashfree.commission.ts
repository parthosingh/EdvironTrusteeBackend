const cf_commision = [
  {
    payment_mode: 'Visa',
    platform_type: 'CreditCard',
    range_charge: [
      {
        charge: 1,
        charge_type: 'FLAT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'CreditCard',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'AU Small Finance Bank',
    platform_type: 'NetBanking',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'NetBanking',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Yes Bank Corporate',
    platform_type: 'NetBanking',
    range_charge: [
      {
        charge: 2,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Paytm',
    platform_type: 'Wallet',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Jio',
    platform_type: 'Wallet',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'Wallet',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'CORPORATE CARDS',
    range_charge: [
      {
        charge: 50,
        charge_type: 'FLAT',
        upto: 20,
      },
      {
        charge: 70,
        charge_type: 'FLAT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'UPI',
    range_charge: [
      {
        charge: 1,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
  {
    payment_mode: 'Others',
    platform_type: 'INTERNATIONAL PG',
    range_charge: [
      {
        charge: 0.5,
        charge_type: 'PERCENT',
        upto: 10,
      },
      {
        charge: 0.5,
        charge_type: 'PERCENT',
        upto: 20,
      },
      {
        charge: 0.5,
        charge_type: 'PERCENT',
        upto: null,
      },
    ],
  },
];

export default cf_commision;

const test = {
  data: {
    settlement: {
      adjustment: 0,
      amount_settled: 123901,
      payment_amount: 123901,
      payment_from: '2025-02-04T10:13:04+05:30',
      payment_till: '2025-02-04T22:36:10+05:30',
      reason: null,
      remarks: null,
      service_charge: 0,
      service_tax: 0,
      settled_on: '2025-02-06T01:03:52+05:30',
      settlement_amount: 123901,
      settlement_charge: 0,
      settlement_id: 124001484,
      settlement_initiated_on: '2025-02-05T19:00:29+05:30',
      settlement_tax: 0,
      settlement_type: 'NORMAL_SETTLEMENT',
      status: 'SUCCESS',
      utr: 'AXISCN0908963502',
    },
  },
  event_time: '2025-02-06T01:03:52+05:30',
  merchant: { merchant_id: 'CF_74dc5650-6a5c-4158-9ee3-8ad61a083c25' },
  type: 'SETTLEMENT_SUCCESS',
};

const g = {
  data: {
    settlement: {
      adjustment: 0,
      amount_settled: 247358,
      payment_amount: 247358,
      payment_from: '2025-02-01T10:06:00+05:30',
      payment_till: '2025-02-02T21:53:45+05:30',
      reason: null,
      remarks: null,
      service_charge: 0,
      service_tax: 0,
      settled_on: '2025-02-03T17:26:47+05:30',
      settlement_amount: 247358,
      settlement_charge: 0,
      settlement_id: 123420396,
      settlement_initiated_on: '2025-02-03T17:26:47+05:30',
      settlement_tax: 0,
      settlement_type: 'NORMAL_SETTLEMENT',
      status: 'SUCCESS',
      utr: 'UTIBR72025020300033126',
    },
  },
  event_time: '2025-02-03T17:26:47+05:30',
  merchant: { merchant_id: 'CF_9422a62a-f043-4dff-bca0-da7201a37139' },
  type: 'SETTLEMENT_SUCCESS',
};
