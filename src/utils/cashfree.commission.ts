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

const dummy = {
  status: '1',
  data: {
    hash: '39712916f03324665feeac9724ac2c5f2a7bbf143bdfacd8ead558edd328f8f39fe0676dcd73ed70e8511b5dbed08ca4220755bed0a775cb7c43fb5b138bde1b',
    paid_out: 1,
    bank_name: 'HDFC Bank',
    ifsc_code: 'HDFC0001203',
    payout_id: 'PTVW19MSSJ',
    payout_date: '2024-10-31 12:06:34.046827',
    name_on_bank: 'THRIVEDGE EDUTECH PRIVATE LIMITED',
    total_amount: 34707.16,
    payout_amount: 34400.0,
    refund_amount: 0.0,
    split_payouts: [],
    account_number: '50200080534081',
    service_tax_amount: 46.86,
    bank_transaction_id: 'NA',
    refund_transactions: [],
    submerchant_payouts: [
      {
        bank_name: 'State bank Of india',
        ifsc_code: 'SBIN0006909',
        name_on_bank: 'JEYPORE COLLEGE OF PHARMACY',
        total_amount: 34707.16,
        payout_amount: 34400.0,
        refund_amount: 0.0,
        account_number: '30289626592',
        submerchant_id: 'S1288102O5Q',
        service_tax_amount: 46.86,
        bank_transaction_id: 'YESB43050060520',
        service_charge_amount: 260.3,
        submerchant_payout_id: 'PSHWQ2YP43',
        submerchant_payout_date: '2024-10-31 06:36:33.755812',
      },
    ],
    settled_transactions: [
      {
        txnid: 'ECMROXYVFL',
        easepayid: 'E2410300B582LG',
        service_tax: 46.86,
        service_charge: 260.3,
        submerchant_id: 'S1288102O5Q',
        transaction_type: 'Credit Card',
        settlement_amount: 34400.0,
        split_transactions: null,
        transaction_amount: 34707.16,
      },
    ],
    service_charge_amount: 260.3,
  },
};

export default cf_commision;
