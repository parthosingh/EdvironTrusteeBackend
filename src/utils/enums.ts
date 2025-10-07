export enum KycDocType {
    AADHAR = 'aadhar',
    BUSINESSPROOF = 'businessProof',
    AUTHPAN = 'authPan',
    BANKPROOF = 'bankProof',
    AFFILIATION = 'affiliation',
    ENTITYPAN = 'entityPan',
    WEBSITE_LINK = 'websiteLink',
    DECLARATION = 'declarationDoc',
    ADDITIONALDOCUMENT = 'additionalDocument',
}

export enum fileType {
  PDF='PDF',
  JPEG = "JPEG",
  JPG = "JPG"
}

export enum BusinessTypes {
    Individual = "Individual",
    Proprietorship = "Proprietorship",
    LLP = "LLP",
    Partnership = "Partnership",
    PrivateLimited = "Private Limited",
    PublicLimited = "Public Limited",
    Trust = "Trust",
    Society = "Society",
    NGO = "NGO",
    HinduUndividedFamily = "Hindu Undivided Family (HUF)",
    AssociationOfPersons = "Association of Persons (AOP)",
    BodyOfIndividuals = "Body of Individuals (BOI)",
    LocalAuthority = "Local Authority",
    ArtificialJuridicalPerson = "Artificial Juridical Person",
    Government = "Government",
    InternationalOrganizations = "International Organizations",
    OnePersonCompany = "One Person Company"
}

export enum KycBusinessCategory {
    EDUCATION = 'Education',
    OTHERS = 'Others'
}

export enum KycBusinessSubCategory {
    AFFILATED_SCHOOL = 'Affilated Schools',
    NON_AFFILATED_SCHOOL = 'NON_AFFILATED_SCHOOL',
    COLLEGE_AND_UNIVERSITY = 'COLLEGE_AND_UNIVERSITY',
}

export enum EasebuzzBankCode {
  AUSFB = "AUSFB",
  AXB = "AXB",
  ACNB = "ACNB",
  BANB = "BANB",
  BOBCB = "BOBCB",
  BOBRB = "BOBRB",
  BOIND = "BOIND",
  BOMH = "BOMH",
  CANB = "CANB",
  CSB = "CSB",
  CBOI = "CBOI",
  CUB = "CUB",
  DCBB = "DCBB",
  FEDB = "FEDB",
  HDFCB = "HDFCB",
  ICICR = "ICICR",
  ICICICO = "ICICICO",
  IDBIB = "IDBIB",
  IDFCFB = "IDFCFB",
  INB = "INB",
  IOB = "IOB",
  IOBC = "IOBC",
  INDUSB = "INDUSB",
  JKB = "JKB",
  JKBC = "JKBC",
  KBL = "KBL",
  KVB = "KVB",
  PNBCB = "PNBCB",
  PNBRB = "PNBRB",
  RBLBL = "RBLBL",
  SIB = "SIB",
  SCB = "SCB",
  SCBC = "SCBC",
  SBOI = "SBOI",
  SBOIC = "SBOIC",
  TMBL = "TMBL",
  UBOI = "UBOI",
  ANB = "ANB",
  YESBL = "YESBL",
}


export enum PaymentMode {
    CC= "CC",
    DC = "DC",
    NB = "NB",
    WALLET="WALLET",
    PAY_LATER="PAY_LATER",
    UPI="UPI"
}

export enum EasebuzzWallets{
    PHONEPE="PHONEPE",
    BJFVWLT="BJFVWLT",
    OLAM="OLAM",
    ATM="ATM",
    AIRTLM="AIRTLM",
    MOBKWK="MOBKWK"
}

export enum EasebuzzPayLater {
  SIMPL = "Simpl",
  LAZYPAY = "LazyPay",
  FLEXIPAY = "FlexiPay",
  KOTAK = "Kotak",
  ZESTMONEY = "ZestMoney",
  OLAPOSTPAID = "OlaPostPaid",
}


export class SettlementRecon {
    utrNumber: string;
    from_date: string;
    till_date: string;
    settlement_date: string;
    school_id: string;
    settlementAmount: number;
    adjustment: number;
    settlementInitiatedOn: string;
    transactions: [
        {
            order_amount: number,
            transaction_amount: number;
            settlement_amount:number;
            collect_id: string;
            custom_order_id: string;
            tranasction_time: string;
            order_time: string,
            bank_reff: string;
            paymet_mode: string;
            payment_details: string;
            additional_data: string;
            gateway: string;
            payment_id:string;
            status:string,
            student_details: {
                student_id: string;
                student_name: string;
                student_email: string;
                student_phone_no: string;
            }
            split_info: [
                {
                    vendor_id: string,
                    amount: number,
                    percentage?: number
                }
            ]
        }
    ];
    refunds: [
        {
            refund_id: string;
            collect_id: string;
            custom_order_id: string;
            refund_amount: number;
            order_amount: number;
            split_refund_details: [{
                vendor_id: string,
                amount: number
            }]
        }
    ]

}

export enum UpiModes {
    QR="QR",
    VPA="VPA"
}