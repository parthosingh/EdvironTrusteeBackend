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
