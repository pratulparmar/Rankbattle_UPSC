'use client'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getDailyContent } from '@/lib/api'

interface HeadlineItem {
  headline: string
  summary: string
  tags: string[]
  importance: string
}

interface EditorialArticle {
  source: string
  headline: string
  intro: string
  paragraphs: string[]
  upsc_angle: string
  key_terms: string[]
}

interface CardItem {
  topic: string
  icon: string
  content: string
}

interface VocabSection {
  word: string
  pronunciation: string
  meaning: string
  in_context: string
  related_terms: string[]
}

interface Section {
  id: string
  title: string
  type: string
  items?: HeadlineItem[] | CardItem[]
  article?: EditorialArticle
  word?: string
  pronunciation?: string
  meaning?: string
  in_context?: string
  related_terms?: string[]
}

interface DailyContent {
  date: string
  edition: string
  volume: string
  tagline: string
  sections: Section[]
}

export default function AspiriantsDaily() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [content, setContent] = useState<DailyContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('brief')

  useEffect(() => {
    if (!isLoading && !user) router.push('/login')
  }, [user, isLoading])

  useEffect(() => {
    if (!user) return
    getDailyContent()
      .then(res => setContent(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [user])

  if (isLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F4ED' }}>
      <div style={{ fontFamily: 'Georgia, serif', color: '#6B6258', fontSize: '15px' }}>
        Preparing today's edition...
      </div>
    </div>
  )

  if (!content) return null

  const activeData = content.sections.find(s => s.id === activeSection)

  return (
    <div className="min-h-screen" style={{ background: '#F7F4ED', fontFamily: 'Georgia, serif' }}>

      {/* Top Nav Bar */}
      <div className="bg-white border-b px-6 py-3 flex justify-between items-center" style={{ borderColor: '#E8E2D9' }}>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm flex items-center gap-1"
          style={{ color: '#6B6258', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
        >
          ← Dashboard
        </button>
        <span className="text-xs" style={{ color: '#9A8A7A', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          👤 {user?.name}
        </span>
      </div>

      {/* Newspaper Masthead */}
      <div className="text-center py-8 px-4" style={{ borderBottom: '2px solid #1F1B16' }}>
        <div className="flex items-center justify-center gap-4 mb-2">
          <div style={{ height: '1px', width: '60px', background: '#1F1B16' }} />
          <span className="text-xs tracking-widest" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
            {content.volume} · {content.edition}
          </span>
          <div style={{ height: '1px', width: '60px', background: '#1F1B16' }} />
        </div>
        <h1 className="font-bold italic" style={{ fontSize: 'clamp(32px, 7vw, 72px)', color: '#1F1B16', lineHeight: 1.1, letterSpacing: '-1px' }}>
          The Aspirant's Daily
        </h1>
        <p className="mt-2 tracking-widest text-xs" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
          {content.tagline.toUpperCase()}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div style={{ height: '1px', flex: 1, maxWidth: '120px', background: '#C4B89A' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#9A7A2E' }} />
          <p className="text-xs tracking-widest" style={{ color: '#9A8A7A', fontFamily: '-apple-system, sans-serif' }}>
            {content.date}
          </p>
          <div className="w-2 h-2 rounded-full" style={{ background: '#9A7A2E' }} />
          <div style={{ height: '1px', flex: 1, maxWidth: '120px', background: '#C4B89A' }} />
        </div>
      </div>

      {/* Section Nav */}
      <div className="flex overflow-x-auto gap-0 border-b" style={{ borderColor: '#C4B89A', background: '#F0EBE3' }}>
        {content.sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-5 py-3 text-xs tracking-widest whitespace-nowrap transition-all"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              color: activeSection === s.id ? '#1F1B16' : '#6B6258',
              borderBottom: activeSection === s.id ? '2px solid #9A7A2E' : '2px solid transparent',
              background: activeSection === s.id ? '#F7F4ED' : 'transparent',
              fontWeight: activeSection === s.id ? '600' : '400',
              marginBottom: '-1px',
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Headlines Section */}
        {activeData?.type === 'headlines' && (
          <div>
            <SectionDivider title={activeData.title} />
            <div className="space-y-6">
              {(activeData.items as HeadlineItem[]).map((item, i) => (
                <article key={i} className="pb-6" style={{ borderBottom: i < activeData.items!.length - 1 ? '1px solid #C4B89A' : 'none' }}>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: tag.startsWith('GS') ? '#F4E8C1' : '#E8EFF8',
                          color: tag.startsWith('GS') ? '#7A5A1E' : '#2A4A7A',
                          fontFamily: '-apple-system, sans-serif',
                          border: `1px solid ${tag.startsWith('GS') ? '#D4C48A' : '#B0C8E8'}`
                        }}>
                        {tag}
                      </span>
                    ))}
                    {item.importance === 'high' && (
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: '#FEE8E8', color: '#A02020', fontFamily: '-apple-system, sans-serif', border: '1px solid #F0B8B8' }}>
                        High Priority
                      </span>
                    )}
                  </div>
                  <h2 className="font-bold mb-2" style={{ fontSize: '18px', color: '#1F1B16', lineHeight: 1.3 }}>
                    {item.headline}
                  </h2>
                  <p style={{ color: '#4A4035', fontSize: '15px', lineHeight: 1.7 }}>
                    {item.summary}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Editorial Section */}
        {activeData?.type === 'editorial' && activeData.article && (
          <div>
            <SectionDivider title={activeData.title} />
            <div className="mb-2 text-xs tracking-widest" style={{ color: '#9A8A7A', fontFamily: '-apple-system, sans-serif' }}>
              SOURCE: {activeData.article.source.toUpperCase()}
            </div>
            <h2 className="font-bold italic mb-4" style={{ fontSize: '24px', color: '#1F1B16', lineHeight: 1.3 }}>
              {activeData.article.headline}
            </h2>
            <p className="font-semibold mb-4" style={{ color: '#4A4035', fontSize: '16px', lineHeight: 1.7, borderLeft: '3px solid #9A7A2E', paddingLeft: '16px' }}>
              {activeData.article.intro}
            </p>
            {activeData.article.paragraphs.map((para, i) => (
              <p key={i} className="mb-4" style={{ color: '#3A3028', fontSize: '15px', lineHeight: 1.8 }}>
                {para}
              </p>
            ))}

            {/* UPSC Angle Box */}
            <div className="mt-6 p-4 rounded" style={{ background: '#F4E8C1', border: '1px solid #D4C48A' }}>
              <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#7A5A1E', fontFamily: '-apple-system, sans-serif' }}>
                📋 UPSC ANGLE
              </div>
              <p style={{ color: '#5A4010', fontSize: '14px', lineHeight: 1.6, fontFamily: '-apple-system, sans-serif' }}>
                {activeData.article.upsc_angle}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {activeData.article.key_terms.map(term => (
                  <span key={term} className="text-xs px-2 py-1 rounded"
                    style={{ background: '#EAD890', color: '#5A4010', fontFamily: '-apple-system, sans-serif', border: '1px solid #C4A840' }}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Current Affairs Cards */}
        {activeData?.type === 'cards' && (
          <div>
            <SectionDivider title={activeData.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              {(activeData.items as CardItem[]).map((card, i) => (
                <div key={i} className="p-5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #C4B89A', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontSize: '20px' }}>{card.icon}</span>
                    <span className="text-xs font-bold tracking-widest" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
                      {card.topic.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ color: '#3A3028', fontSize: '14px', lineHeight: 1.7, fontFamily: '-apple-system, sans-serif' }}>
                    {card.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocabulary Section */}
        {activeData?.type === 'vocabulary' && (
          <div>
            <SectionDivider title={activeData.title} />
            <div className="text-center mb-8">
              <h2 className="font-bold italic" style={{ fontSize: '48px', color: '#1F1B16' }}>
                {activeData.word}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#9A8A7A', fontFamily: '-apple-system, sans-serif', fontStyle: 'italic' }}>
                /{activeData.pronunciation}/
              </p>
            </div>

            <div className="mb-6 p-5 rounded" style={{ background: '#FFFFFF', border: '1px solid #C4B89A' }}>
              <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
                MEANING
              </div>
              <p style={{ color: '#3A3028', fontSize: '16px', lineHeight: 1.7 }}>
                {activeData.meaning}
              </p>
            </div>

            <div className="mb-6 p-5 rounded" style={{ background: '#F0EBE3', border: '1px solid #C4B89A', borderLeft: '3px solid #9A7A2E' }}>
              <div className="text-xs font-bold tracking-widest mb-2" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
                IN CONTEXT
              </div>
              <p className="italic" style={{ color: '#4A4035', fontSize: '15px', lineHeight: 1.7 }}>
                "{activeData.in_context}"
              </p>
            </div>

            <div>
              <div className="text-xs font-bold tracking-widest mb-3" style={{ color: '#6B6258', fontFamily: '-apple-system, sans-serif' }}>
                RELATED TERMS
              </div>
              <div className="flex flex-wrap gap-2">
                {activeData.related_terms?.map(term => (
                  <span key={term} className="px-3 py-1.5 rounded text-sm"
                    style={{ background: '#E8E2D9', color: '#4A4035', fontFamily: '-apple-system, sans-serif', border: '1px solid #C4B89A' }}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="text-center py-6 px-4" style={{ borderTop: '1px solid #C4B89A' }}>
        <div className="w-2 h-2 rounded-full mx-auto mb-3" style={{ background: '#9A7A2E' }} />
        <p className="text-xs tracking-widest" style={{ color: '#9A8A7A', fontFamily: '-apple-system, sans-serif' }}>
          THE ASPIRANT'S DAILY · RANKBATTLE UPSC · {content.date}
        </p>
      </div>

    </div>
  )
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-6 pb-3" style={{ borderBottom: '2px solid #1F1B16' }}>
      <div style={{ borderBottom: '1px solid #1F1B16', paddingBottom: '8px' }}>
        <h2 className="font-bold tracking-widest text-sm" style={{ color: '#1F1B16', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          {title}
        </h2>
      </div>
    </div>
  )
}
