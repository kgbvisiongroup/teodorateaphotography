// Ponude: spisak, nova ponuda, slanje klijentu i praćenje odgovora.
import SwiftUI

struct OffersView: View {
    @State private var all: [Offer] = []
    @State private var filter = "open"
    @State private var loading = true
    @State private var error: String?
    @State private var showNew = false

    private let filters = [("open", "U toku"), ("accepted", "Prihvaćene"), ("closed", "Završene"), ("all", "Sve")]

    private var shown: [Offer] {
        all.filter { o in
            switch filter {
            case "open": return ["draft", "sent", "accepted"].contains(o.status)
            case "accepted": return ["accepted", "booked"].contains(o.status)
            case "closed": return ["declined", "expired", "booked"].contains(o.status)
            default: return true
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    Picker("", selection: $filter) {
                        ForEach(filters, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    .pickerStyle(.segmented)

                    if loading && all.isEmpty { ProgressView().padding(.top, 30) }
                    if let error { Card { Text(error).foregroundStyle(Brand.err) } }

                    if shown.isEmpty && !loading {
                        Card { EmptyNote(text: "Nema ponuda u ovom pregledu.") }
                    } else {
                        ForEach(shown) { o in
                            NavigationLink { OfferDetail(offer: o, onChange: { Task { await load() } }) } label: {
                                OfferRow(o: o)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .background(Brand.wash)
            .navigationTitle("Ponude")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showNew = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showNew) {
                NewOfferSheet { Task { await load() } }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            all = try await API.shared.get("/api/admin/offers", as: [Offer].self)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

struct OfferRow: View {
    let o: Offer

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(o.clientName).font(.body.weight(.medium))
                    Spacer()
                    StatusTag(text: Status.offer(o.status).0, color: Status.offer(o.status).1)
                }
                Text([o.code, o.categoryName, o.price.packageName].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary)
                HStack {
                    Text(Fmt.money(o.price.total)).font(.subheadline.weight(.semibold)).foregroundStyle(Brand.deep)
                    if o.price.deposit > 0 {
                        Text("kapara \(Fmt.money(o.price.deposit))").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let v = o.validUntil { Text("važi do \(Fmt.dateShort(v))").font(.caption2).foregroundStyle(.secondary) }
                }
            }
        }
    }
}

// MARK: - Detalji ponude

struct OfferDetail: View {
    let offer: Offer
    var onChange: () -> Void

    @State private var o: Offer
    @State private var busy = false
    @State private var message: String?
    @EnvironmentObject var api: API

    init(offer: Offer, onChange: @escaping () -> Void) {
        self.offer = offer
        self.onChange = onChange
        _o = State(initialValue: offer)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(o.clientName).font(.title3.weight(.semibold))
                            Spacer()
                            StatusTag(text: Status.offer(o.status).0, color: Status.offer(o.status).1)
                        }
                        Text(o.code).font(.caption).foregroundStyle(.secondary)
                        if let c = o.categoryName, !c.isEmpty { Text(c).font(.subheadline) }
                        if let d = o.date { Text("Predlog termina: \(Fmt.date(d))\(o.time.map { " u \($0)" } ?? "")").font(.subheadline).foregroundStyle(.secondary) }
                        if let n = o.clientNote, !n.isEmpty {
                            Text("Poruka klijenta: „\(n)“").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Iznos").font(.headline)
                        if let p = o.price.packageName, !p.isEmpty { row("Paket", p) }
                        row("Ukupno", Fmt.money(o.price.total))
                        if o.price.deposit > 0 {
                            row("Kapara", Fmt.money(o.price.deposit))
                            row("Ostatak", Fmt.money(o.price.remaining))
                        }
                    }
                }

                VStack(spacing: 10) {
                    if ["draft", "sent", "expired"].contains(o.status) {
                        actionButton(o.status == "draft" ? "Pošalji ponudu klijentu" : "Pošalji ponovo", "paperplane.fill", primary: true) {
                            await send()
                        }
                    }
                    if let url = api.absolute("/ponuda/\(o.token)") {
                        Link(destination: url) {
                            Label("Otvori ponudu kao klijent", systemImage: "safari")
                                .frame(maxWidth: .infinity).padding(.vertical, 13)
                                .background(Color(.systemBackground), in: Capsule())
                                .overlay(Capsule().stroke(Brand.blush, lineWidth: 1))
                        }
                    }
                    if o.status == "accepted" {
                        actionButton("Označi da je zakazano", "checkmark.circle", primary: false) {
                            await state("booked")
                        }
                    }
                }

                if let m = message { Text(m).font(.footnote).foregroundStyle(Brand.ok) }
            }
            .padding(16)
        }
        .background(Brand.wash)
        .navigationTitle("Ponuda")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k).foregroundStyle(.secondary); Spacer(); Text(v).fontWeight(.medium) }.font(.subheadline)
    }

    private func actionButton(_ title: String, _ icon: String, primary: Bool, action: @escaping () async -> Void) -> some View {
        Button {
            Task { busy = true; await action(); busy = false }
        } label: {
            Label(title, systemImage: icon)
                .frame(maxWidth: .infinity).padding(.vertical, 13)
        }
        .background(primary ? Brand.accent : Brand.blush, in: Capsule())
        .foregroundStyle(primary ? .white : Brand.deep)
        .disabled(busy)
    }

    private func send() async {
        do {
            o = try await API.shared.post("/api/admin/offers/\(o.id)/send", [:], as: Offer.self)
            message = "Ponuda je poslata na \(o.email)."
            onChange()
        } catch { message = error.localizedDescription }
    }

    private func state(_ s: String) async {
        do {
            o = try await API.shared.post("/api/admin/offers/\(o.id)/state", ["status": s], as: Offer.self)
            message = "Sačuvano."
            onChange()
        } catch { message = error.localizedDescription }
    }
}

// MARK: - Nova ponuda

struct NewOfferSheet: View {
    var onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var category = ""
    @State private var packageId = ""
    @State private var discount = ""
    @State private var deposit = ""
    @State private var intro = ""
    @State private var validUntil = Date().addingTimeInterval(7 * 86400)
    @State private var categories: [Category] = []
    @State private var packages: [Package] = []
    @State private var busy = false
    @State private var error: String?
    @State private var sendNow = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Klijent") {
                    TextField("Ime i prezime", text: $name)
                    TextField("Email", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                    TextField("Telefon", text: $phone).keyboardType(.phonePad)
                }
                Section("Ponuda") {
                    Picker("Vrsta fotografisanja", selection: $category) {
                        Text("—").tag("")
                        ForEach(categories) { Text($0.name).tag($0.key) }
                    }
                    Picker("Paket", selection: $packageId) {
                        Text("Bez paketa").tag("")
                        ForEach(packages.filter { category.isEmpty || $0.category == category }) {
                            Text("\($0.name) – \(Fmt.money($0.price))").tag($0.id)
                        }
                    }
                    TextField("Popust (%)", text: $discount).keyboardType(.numberPad)
                    TextField("Kapara", text: $deposit).keyboardType(.numberPad)
                    DatePicker("Važi do", selection: $validUntil, displayedComponents: .date)
                }
                Section("Poruka klijentu") {
                    TextField("Npr. Hvala na interesovanju…", text: $intro, axis: .vertical).lineLimit(3...6)
                }
                Section {
                    Toggle("Pošalji odmah emailom", isOn: $sendNow)
                }
                if let error {
                    Section { Text(error).foregroundStyle(Brand.err) }
                }
            }
            .navigationTitle("Nova ponuda")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Čuvam…" : "Sačuvaj") { Task { await save() } }
                        .disabled(busy || name.isEmpty || email.isEmpty)
                }
            }
            .task {
                let meta: Meta? = try? await API.shared.get("/api/admin/meta")
                categories = meta?.categories ?? []
                packages = (try? await API.shared.get("/api/admin/packages", as: [Package].self)) ?? []
            }
        }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        let body: [String: Any] = [
            "clientName": name, "email": email, "phone": phone,
            "category": category, "packageId": packageId,
            "discountPct": discount, "deposit": deposit,
            "intro": intro, "validUntil": f.string(from: validUntil),
        ]
        do {
            let saved: Offer = try await API.shared.post("/api/admin/offers", body, as: Offer.self)
            if sendNow { _ = try? await API.shared.post("/api/admin/offers/\(saved.id)/send", [:]) }
            onSaved()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}
