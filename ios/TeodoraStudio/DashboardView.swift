// Danas: šta predstoji, šta čeka obradu i šta traži pažnju.
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var session: Session
    @State private var stats: Stats?
    @State private var error: String?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if loading && stats == nil {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                    }
                    if let error {
                        Card { Text(error).foregroundStyle(Brand.err) }
                    }
                    if let s = stats {
                        alerts(s)
                        numbers(s)
                        upcoming(s)
                        editing(s)
                    }
                }
                .padding(16)
            }
            .background(Brand.wash)
            .navigationTitle(pozdrav)
            .navigationBarTitleDisplayMode(.large)
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private var pozdrav: String {
        let h = Calendar.current.component(.hour, from: Date())
        let ime = (session.user?.name ?? "").split(separator: " ").first.map(String.init) ?? ""
        let deo = h < 11 ? "Dobro jutro" : (h < 18 ? "Dobar dan" : "Dobro veče")
        return ime.isEmpty ? deo : "\(deo), \(ime)"
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            stats = try await API.shared.get("/api/admin/stats", as: Stats.self)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @ViewBuilder private func alerts(_ s: Stats) -> some View {
        VStack(spacing: 10) {
            if let n = s.acceptedOffers, n > 0 {
                alertRow("\(n) \(n == 1 ? "prihvaćena ponuda čeka" : "prihvaćenih ponuda čeka") zakazivanje.", "doc.badge.plus", Brand.ok)
            }
            if let n = s.newRequests, n > 0 {
                alertRow("\(n) \(n == 1 ? "nov upit" : "novih upita") sa sajta čeka odgovor.", "envelope.badge", Brand.warn)
            }
            if let n = s.newAlbums, n > 0 {
                alertRow("\(n) \(n == 1 ? "nov album je poručen" : "novih albuma je poručeno") sa sajta.", "book.closed", Brand.accent)
            }
            if let n = s.overdue, n > 0 {
                alertRow("Rok za obradu je istekao za \(n) \(n == 1 ? "fotografisanje" : "fotografisanja").", "exclamationmark.triangle", Brand.err)
            }
            if let n = s.lowStock, n > 0 {
                alertRow("\(n) \(n == 1 ? "artikal u magacinu je" : "artikla u magacinu su") pri kraju.", "shippingbox", Brand.warn)
            }
        }
    }

    private func alertRow(_ text: String, _ icon: String, _ color: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(color)
            Text(text).font(.subheadline)
            Spacer()
        }
        .padding(14)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func numbers(_ s: Stats) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            stat("Fotografisanja", "\(s.upcoming?.count ?? 0)", "narednih 14 dana")
            stat("Čeka obradu", "\(s.editing?.count ?? 0)", s.overdue ?? 0 > 0 ? "\(s.overdue ?? 0) kasni" : "sve u roku")
            stat("Aktivni linkovi", "\(s.active ?? 0)", "\(s.waiting ?? 0) još nije preuzeto")
            stat("Zauzet prostor", Fmt.size(s.storage), "fotografije na serveru")
        }
    }

    private func stat(_ title: String, _ value: String, _ sub: String) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.caption).foregroundStyle(.secondary)
                Text(value).font(.title.weight(.semibold)).foregroundStyle(Brand.deep)
                Text(sub).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder private func upcoming(_ s: Stats) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Narednih 14 dana").font(.headline)
            if let list = s.upcoming, !list.isEmpty {
                ForEach(list) { b in
                    NavigationLink { BookingDetail(bookingId: b.id) } label: { BookingRow(b: b) }
                        .buttonStyle(.plain)
                }
            } else {
                Card { EmptyNote(text: "Nema zakazanih fotografisanja.") }
            }
        }
    }

    @ViewBuilder private func editing(_ s: Stats) -> some View {
        if let list = s.editing, !list.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Obrada fotografija").font(.headline)
                ForEach(list) { b in
                    NavigationLink { BookingDetail(bookingId: b.id) } label: { BookingRow(b: b, showDeadline: true) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Red u listi zakazivanja

struct BookingRow: View {
    let b: Booking
    var showDeadline = false

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 2) {
                    Text(dayNumber).font(.title3.weight(.semibold)).foregroundStyle(Brand.deep)
                    Text(monthShort).font(.caption2).foregroundStyle(.secondary)
                }
                .frame(width: 44)

                VStack(alignment: .leading, spacing: 3) {
                    Text(b.clientName ?? "—").font(.body.weight(.medium))
                    Text([b.catName, b.time, b.location].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if showDeadline, let d = b.daysLeft {
                        Text(d < 0 ? "rok istekao pre \(-d) dana" : "rok za obradu: još \(d) dana")
                            .font(.caption2)
                            .foregroundStyle(d < 0 ? Brand.err : .secondary)
                    }
                }
                Spacer(minLength: 6)
                StatusTag(text: Status.booking(b.status).0, color: Status.booking(b.status).1)
            }
        }
    }

    private var dayNumber: String {
        let p = b.date.split(separator: "-")
        return p.count == 3 ? String(Int(p[2]) ?? 0) : "?"
    }

    private var monthShort: String {
        let p = b.date.split(separator: "-")
        guard p.count == 3, let m = Int(p[1]), m >= 1, m <= 12 else { return "" }
        return String(Fmt.months[m - 1].prefix(3))
    }
}
