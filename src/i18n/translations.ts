export type AppLanguage = "en-US" | "fr-CA" | "es-US";

export type TranslationKey =
  | "tabs.home"
  | "tabs.parcels"
  | "tabs.trips"
  | "tabs.buddies"
  | "tabs.profile"
  | "stack.sendParcel"
  | "stack.listTrip"
  | "stack.wallet"
  | "stack.earnings"
  | "stack.reviews"
  | "reviews.dataOffTitle"
  | "reviews.dataOffHint"
  | "reviews.body.1"
  | "reviews.body.2"
  | "reviews.body.3"
  | "reviews.body.4"
  | "wallet.availableBalance"
  | "wallet.addMoney"
  | "wallet.withdraw"
  | "wallet.inEscrow"
  | "wallet.totalEarned"
  | "wallet.paymentMethods"
  | "wallet.addCard"
  | "wallet.noPaymentMethods"
  | "wallet.addACard"
  | "wallet.recentTransactions"
  | "wallet.noTransactionsYet"
  | "wallet.default"
  | "wallet.txPayout"
  | "wallet.txEscrowHold"
  | "wallet.txRefund"
  | "wallet.statusCompleted"
  | "wallet.statusHeld"
  | "wallet.statusRefunded"
  | "earnings.heroTotalLabel"
  | "earnings.deliveriesPaid"
  | "earnings.pending"
  | "earnings.withdrawToBank"
  | "earnings.history"
  | "earnings.deliveryPayout"
  | "earnings.statusPending"
  | "earnings.statusCompleted"
  | "earnings.emptyHistory"
  | "profile.kycVerified"
  | "profile.wallet"
  | "profile.walletSubtitle"
  | "profile.editProfile"
  | "profile.kycVerification"
  | "profile.earnings"
  | "profile.messages"
  | "profile.reviews"
  | "profile.settings"
  | "profile.language"
  | "profile.signOut"
  | "profile.fieldFullName"
  | "profile.fieldEmail"
  | "profile.fieldPhone"
  | "profile.fieldBio"
  | "profile.saveChanges"
  | "profile.changePhoto"
  | "kyc.verifiedTitle"
  | "kyc.verifiedBody"
  | "kyc.verifiedDocumentsSection"
  | "kyc.docPassportFront"
  | "kyc.docPassportBack"
  | "kyc.docSelfieWithId";

type Dict = Record<TranslationKey, string>;

const enUS: Dict = {
  "tabs.home": "Home",
  "tabs.parcels": "My travels",
  "tabs.trips": "Search",
  "tabs.buddies": "Inbox",
  "tabs.profile": "Profile",
  "stack.sendParcel": "Send Parcel",
  "stack.listTrip": "List Trip",
  "stack.wallet": "Wallet",
  "stack.earnings": "Earnings",
  "stack.reviews": "Reviews",
  "reviews.dataOffTitle": "No reviews yet",
  "reviews.dataOffHint": "Reviews from your delivery interactions will appear here.",
  "reviews.body.1": "Very reliable carrier! Delivered on time.",
  "reviews.body.2": "Great communication throughout. Parcel arrived in perfect condition.",
  "reviews.body.3": "Smooth handoff at the airport. Would book again.",
  "reviews.body.4": "Professional and friendly. Highly recommended.",
  "wallet.availableBalance": "Available balance",
  "wallet.addMoney": "Add Money",
  "wallet.withdraw": "Withdraw",
  "wallet.inEscrow": "In escrow",
  "wallet.totalEarned": "Total earned",
  "wallet.paymentMethods": "Payment Methods",
  "wallet.addCard": "+ Add Card",
  "wallet.noPaymentMethods": "No payment methods",
  "wallet.addACard": "Add a Card",
  "wallet.recentTransactions": "Recent Transactions",
  "wallet.noTransactionsYet": "No transactions yet",
  "wallet.default": "Default",
  "wallet.txPayout": "Payout",
  "wallet.txEscrowHold": "Escrow Hold",
  "wallet.txRefund": "Refund",
  "wallet.statusCompleted": "Completed",
  "wallet.statusHeld": "Held",
  "wallet.statusRefunded": "Refunded",
  "earnings.heroTotalLabel": "Total earned",
  "earnings.deliveriesPaid": "Deliveries paid",
  "earnings.pending": "Pending",
  "earnings.withdrawToBank": "Withdraw to Bank",
  "earnings.history": "Earning History",
  "earnings.deliveryPayout": "Delivery Payout",
  "earnings.statusPending": "Pending",
  "earnings.statusCompleted": "Completed",
  "earnings.emptyHistory": "No earnings yet",
  "profile.kycVerified": "KYC Verified",
  "profile.wallet": "Wallet",
  "profile.walletSubtitle": "Balance & payments",
  "profile.editProfile": "Edit Profile",
  "profile.kycVerification": "KYC Verification",
  "profile.earnings": "Earnings",
  "profile.messages": "Messages",
  "profile.reviews": "Reviews",
  "profile.settings": "Settings",
  "profile.language": "Language",
  "profile.signOut": "Sign Out",
  "profile.fieldFullName": "Full name",
  "profile.fieldEmail": "Email",
  "profile.fieldPhone": "Phone",
  "profile.fieldBio": "Bio",
  "profile.saveChanges": "Save Changes",
  "profile.changePhoto": "Change profile photo",
  "kyc.verifiedTitle": "Verified",
  "kyc.verifiedBody": "Your identity has been verified. You can send and carry parcels.",
  "kyc.verifiedDocumentsSection": "VERIFIED DOCUMENTS",
  "kyc.docPassportFront": "Passport — Front",
  "kyc.docPassportBack": "Passport — Back",
  "kyc.docSelfieWithId": "Selfie with ID",
};

const frCA: Dict = {
  "tabs.home": "Accueil",
  "tabs.parcels": "Mes voyages",
  "tabs.trips": "Recherche",
  "tabs.buddies": "Messages",
  "tabs.profile": "Profil",
  "stack.sendParcel": "Envoyer un colis",
  "stack.listTrip": "Lister un voyage",
  "stack.wallet": "Portefeuille",
  "stack.earnings": "Gains",
  "stack.reviews": "Avis",
  "reviews.dataOffTitle": "Aucun avis",
  "reviews.dataOffHint": "Activez les donnees pour voir les avis de vos destinataires.",
  "reviews.body.1": "Transporteur tres fiable! Livraison a l'heure.",
  "reviews.body.2": "Excellente communication. Colis arrive en parfait etat.",
  "reviews.body.3": "Remise fluide a l'aeroport. Je referais appel.",
  "reviews.body.4": "Professionnel et sympathique. Tres recommande.",
  "wallet.availableBalance": "Solde disponible",
  "wallet.addMoney": "Ajouter",
  "wallet.withdraw": "Retirer",
  "wallet.inEscrow": "En sequestre",
  "wallet.totalEarned": "Total gagne",
  "wallet.paymentMethods": "Moyens de paiement",
  "wallet.addCard": "+ Ajouter une carte",
  "wallet.noPaymentMethods": "Aucun moyen de paiement",
  "wallet.addACard": "Ajouter une carte",
  "wallet.recentTransactions": "Transactions recentes",
  "wallet.noTransactionsYet": "Aucune transaction",
  "wallet.default": "Par defaut",
  "wallet.txPayout": "Versement",
  "wallet.txEscrowHold": "Blocage sequestre",
  "wallet.txRefund": "Remboursement",
  "wallet.statusCompleted": "Termine",
  "wallet.statusHeld": "En attente",
  "wallet.statusRefunded": "Rembourse",
  "earnings.heroTotalLabel": "Total gagne",
  "earnings.deliveriesPaid": "Livraisons payees",
  "earnings.pending": "En attente",
  "earnings.withdrawToBank": "Retirer vers la banque",
  "earnings.history": "Historique des gains",
  "earnings.deliveryPayout": "Paiement de livraison",
  "earnings.statusPending": "En attente",
  "earnings.statusCompleted": "Termine",
  "earnings.emptyHistory": "Aucun gain pour le moment",
  "profile.kycVerified": "KYC Verifie",
  "profile.wallet": "Portefeuille",
  "profile.walletSubtitle": "Solde et paiements",
  "profile.editProfile": "Modifier le profil",
  "profile.kycVerification": "Verification KYC",
  "profile.earnings": "Gains",
  "profile.messages": "Messages",
  "profile.reviews": "Avis",
  "profile.settings": "Parametres",
  "profile.language": "Langue",
  "profile.signOut": "Se deconnecter",
  "profile.fieldFullName": "Nom complet",
  "profile.fieldEmail": "Courriel",
  "profile.fieldPhone": "Telephone",
  "profile.fieldBio": "Bio",
  "profile.saveChanges": "Enregistrer",
  "profile.changePhoto": "Changer la photo de profil",
  "kyc.verifiedTitle": "Verifie",
  "kyc.verifiedBody": "Votre identite est verifiee. Vous pouvez envoyer et transporter des colis.",
  "kyc.verifiedDocumentsSection": "DOCUMENTS VERIFIES",
  "kyc.docPassportFront": "Passeport — Recto",
  "kyc.docPassportBack": "Passeport — Verso",
  "kyc.docSelfieWithId": "Selfie avec piece",
};

const esUS: Dict = {
  "tabs.home": "Inicio",
  "tabs.parcels": "Mis viajes",
  "tabs.trips": "Buscar",
  "tabs.buddies": "Mensajes",
  "tabs.profile": "Perfil",
  "stack.sendParcel": "Enviar paquete",
  "stack.listTrip": "Publicar viaje",
  "stack.wallet": "Billetera",
  "stack.earnings": "Ganancias",
  "stack.reviews": "Resenas",
  "reviews.dataOffTitle": "Sin resenas",
  "reviews.dataOffHint": "Activa los datos de la app para ver resenas de tus destinatarios.",
  "reviews.body.1": "Transportista muy confiable! Entrega a tiempo.",
  "reviews.body.2": "Gran comunicacion. El paquete llego en perfecto estado.",
  "reviews.body.3": "Entrega sin problemas en el aeropuerto. Repetiria.",
  "reviews.body.4": "Profesional y amable. Muy recomendado.",
  "wallet.availableBalance": "Saldo disponible",
  "wallet.addMoney": "Agregar",
  "wallet.withdraw": "Retirar",
  "wallet.inEscrow": "En deposito",
  "wallet.totalEarned": "Total ganado",
  "wallet.paymentMethods": "Metodos de pago",
  "wallet.addCard": "+ Anadir tarjeta",
  "wallet.noPaymentMethods": "Sin metodos de pago",
  "wallet.addACard": "Anadir tarjeta",
  "wallet.recentTransactions": "Transacciones recientes",
  "wallet.noTransactionsYet": "Sin transacciones aun",
  "wallet.default": "Predeterminada",
  "wallet.txPayout": "Pago",
  "wallet.txEscrowHold": "Retencion",
  "wallet.txRefund": "Reembolso",
  "wallet.statusCompleted": "Completada",
  "wallet.statusHeld": "Retenida",
  "wallet.statusRefunded": "Reembolsada",
  "earnings.heroTotalLabel": "Total ganado",
  "earnings.deliveriesPaid": "Entregas pagadas",
  "earnings.pending": "Pendiente",
  "earnings.withdrawToBank": "Retirar al banco",
  "earnings.history": "Historial de ganancias",
  "earnings.deliveryPayout": "Pago de entrega",
  "earnings.statusPending": "Pendiente",
  "earnings.statusCompleted": "Completada",
  "earnings.emptyHistory": "Sin ganancias aun",
  "profile.kycVerified": "KYC Verificado",
  "profile.wallet": "Billetera",
  "profile.walletSubtitle": "Saldo y pagos",
  "profile.editProfile": "Editar perfil",
  "profile.kycVerification": "Verificacion KYC",
  "profile.earnings": "Ganancias",
  "profile.messages": "Mensajes",
  "profile.reviews": "Resenas",
  "profile.settings": "Configuracion",
  "profile.language": "Idioma",
  "profile.signOut": "Cerrar sesion",
  "profile.fieldFullName": "Nombre completo",
  "profile.fieldEmail": "Correo",
  "profile.fieldPhone": "Telefono",
  "profile.fieldBio": "Bio",
  "profile.saveChanges": "Guardar cambios",
  "profile.changePhoto": "Cambiar foto de perfil",
  "kyc.verifiedTitle": "Verificado",
  "kyc.verifiedBody": "Tu identidad ha sido verificada. Puedes enviar y transportar paquetes.",
  "kyc.verifiedDocumentsSection": "DOCUMENTOS VERIFICADOS",
  "kyc.docPassportFront": "Pasaporte — Frente",
  "kyc.docPassportBack": "Pasaporte — Reverso",
  "kyc.docSelfieWithId": "Selfie con identificacion",
};

const dictionaries: Record<AppLanguage, Dict> = {
  "en-US": enUS,
  "fr-CA": frCA,
  "es-US": esUS,
};

export function t(language: AppLanguage, key: TranslationKey): string {
  return dictionaries[language][key] ?? enUS[key];
}
