import React, { useState } from 'react';
import { HelpCircle, Mail, MessageCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';

const Support: React.FC = () => {
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    const faqs = [
        {
            question: "TarımPros platformunu nasıl kullanmaya başlayabilirim?",
            answer: "Kayıt olduktan sonra, profilinizi tamamlayarak ve tarlalarınızı sisteme ekleyerek başlayabilirsiniz. Daha sonra ürün planlama modülünü kullanarak ekim önerileri alabilirsiniz."
        },
        {
            question: "Ürün planlama verileri ne sıklıkla güncellenir?",
            answer: "Piyasa verileri günlük olarak, iklim verileri ise anlık olarak güncellenmektedir. Yapay zeka modellerimiz her hafta yeni verilerle eğitilerek daha hassas tahminler sunar."
        },
        {
            question: "Premium üyelik avantajları nelerdir?",
            answer: "Premium üyelerimiz detaylı iklim risk raporlarına, gelişmiş pazar analizlerine ve 7/24 uzman ziraat mühendisi desteğine erişebilirler."
        },
        {
            question: "Verilerim güvende mi?",
            answer: "Evet, tüm verileriniz endüstri standartlarında şifreleme yöntemleriyle korunmaktadır. KVKK kapsamında verileriniz üçüncü şahıslarla izniniz olmadan paylaşılmaz."
        }
    ];

    const toggleFaq = (index: number) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Yardım ve Destek</h1>
                    <p className="text-slate-600 dark:text-slate-400">Sorularınız için buradayız</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* FAQ Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <HelpCircle className="text-emerald-600" size={24} />
                            Sıkça Sorulan Sorular
                        </h2>
                        <div className="space-y-3">
                            {faqs.map((faq, index) => (
                                <div key={index} className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleFaq(index)}
                                        className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                                    >
                                        <span className="font-medium text-slate-700 dark:text-slate-200">{faq.question}</span>
                                        {openFaq === index ? <ChevronUp size={20} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={20} className="text-slate-500 dark:text-slate-400" />}
                                    </button>
                                    {openFaq === index && (
                                        <div className="p-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700">
                                            {faq.answer}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <MessageCircle className="text-emerald-600" size={24} />
                            Bize Ulaşın
                        </h2>
                        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Konu</label>
                                    <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                                        <option>Genel Soru</option>
                                        <option>Teknik Destek</option>
                                        <option>Öneri / Şikayet</option>
                                        <option>Faturalandırma</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-posta</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                                        placeholder="ornek@email.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mesajınız</label>
                                <textarea
                                    rows={4}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                                    placeholder="Size nasıl yardımcı olabiliriz?"
                                ></textarea>
                            </div>
                            <div className="flex justify-end">
                                <button className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
                                    <Send size={18} />
                                    <span>Gönder</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Contact Info Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-emerald-600 rounded-xl shadow-sm p-6 text-white">
                        <h3 className="text-xl font-bold mb-2">Yardıma mı ihtiyacınız var?</h3>
                        <p className="text-emerald-100 mb-6">Uzman ekibimiz sorularınızı yanıtlamak için 7/24 hizmetinizde.</p>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-emerald-500/50 rounded-lg">
                                    <Mail size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-emerald-50">E-posta</p>
                                    <p className="text-white">destek@tarimpros.com</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-emerald-500/50 rounded-lg">
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-emerald-50">Canlı Destek</p>
                                    <p className="text-white">Hafta içi 09:00 - 18:00</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Diğer Kaynaklar</h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="#" className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm">Kullanım Kılavuzu</a>
                            </li>
                            <li>
                                <a href="#" className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm">Video Eğitimler</a>
                            </li>
                            <li>
                                <a href="#" className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm">Topluluk Forumu</a>
                            </li>
                            <li>
                                <a href="#" className="text-emerald-600 hover:text-emerald-700 hover:underline text-sm">Sürüm Notları</a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Support;
