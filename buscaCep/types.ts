export interface AddressForm {
  street: string;
  number: string;
  city: string;
  state: string;
  complement?: string;
  isRural?: boolean;
}

export interface SearchResult {
  found: boolean;
  mainText: string;
  secondaryText?: string;
  confidence: 'high' | 'medium' | 'low';
}

export enum SearchMode {
  ADDRESS_TO_CEP = 'ADDRESS_TO_CEP',
  CEP_TO_ADDRESS = 'CEP_TO_ADDRESS',
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface HistoryItem {
  mode: SearchMode;
  data: AddressForm | string;
  label: string;
  timestamp: number;
}