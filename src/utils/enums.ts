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
  EDUCATION='Education',
  OTHERS='Others'
}

export enum KycBusinessSubCategory {
  AFFILATED_SCHOOL = 'Affilated Schools',
  NON_AFFILATED_SCHOOL = 'NON_AFFILATED_SCHOOL',
  COLLEGE_AND_UNIVERSITY = 'COLLEGE_AND_UNIVERSITY',
}
