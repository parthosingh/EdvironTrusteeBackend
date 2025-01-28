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
  customer_details: {
    customer_email: null,
    customer_id: '7112AAA812234',
    customer_name: null,
    customer_phone: '9898989898',
  },
  order: {
    order_amount: 6910,
    order_currency: 'INR',
    order_id: '67975144feaa963855f2ce8c',
    order_tags: null,
  },
  payment: {
    auth_id: '006429',
    bank_reference: '502721032474',
    cf_payment_id: 3452636893,
    payment_amount: 6962.99,
    payment_currency: 'INR',
    payment_group: 'debit_card',
    payment_message: 'SUCCESS',
    payment_method: {
      card: {
        card_bank_name: 'THE FEDERAL BANK',
        card_country: 'IN',
        card_network: 'visa',
        card_number: 'XXXXXXXXXXXX0184',
        card_sub_type: 'R',
        card_type: 'debit_card',
        channel: null,
      },
    },
    payment_status: 'SUCCESS',
    payment_time: '2025-01-27T14:57:56+05:30',
  },
  payment_gateway_details: {
    gateway_name: 'CASHFREE',
    gateway_order_id: '3723035096',
    gateway_order_reference_id: 'null',
    gateway_payment_id: '3452636893',
    gateway_settlement: 'CASHFREE',
    gateway_status_code: null,
  },
  payment_offers: null,
};
