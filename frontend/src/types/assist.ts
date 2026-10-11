// Mirrors backend/app/api/schemas/assist.py. Offsets are code points into `text` (normalised, trimmed), or into
// `RephraseOut.sentence` for vocabulary.
export interface RephraseRequest {
  language: string
  text: string
  start: number
  end: number
}

export type Tone = 'natural' | 'formal' | 'casual'

export interface VersionOut {
  text: string
  tone: Tone
  label: string
  explanation: string
}

export interface AlternativeOut {
  word: string
  nuance: string
}

export interface VocabularyOut {
  original: string
  start: number
  end: number
  alternatives: AlternativeOut[]
}

export interface RephraseOut {
  sentence: string
  versions: VersionOut[]
  vocabulary: VocabularyOut[]
}

export interface CompleteRequest {
  language: string
  text: string
}

export interface CompleteOut {
  completion: string
}
