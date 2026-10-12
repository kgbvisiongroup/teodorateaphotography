// Zakazivanja: spisak, pretraga, kalendar i detalji jednog termina.
import SwiftUI

struct BookingsView: View {
    @State private var all: [Booking] = []
    @State private var filter = "upcoming"
    @State private var search = ""
    @State private var showCalendar = false
    @State private var error: String?
    @State private var loading = true

    private let filters = [("upcoming", "Predstoji"), ("edit", "Obrada"), ("done", "Završeno"), ("all", "Sve")]

    var shown: [Booking] {
        let t = Fmt.today()
        return all.filter { b in
            switch filter {
            case "upcoming": return b.date >= t && b.cancelled != true
            case "edit": return b.status == "processing" || b.status == "overdue"
            case "done": return b.status == "done"
            default: return true
            }
        }
        .filter { b in
            guard !search.isEmpty else { return true }
            let s = search.lowercased()
            return [b.clientName, b.email, b.phone, b.catName].compactMap { $0 }.joined(separator: " ").lowercased().contains(s)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if showCalendar {
                    MonthCalendar(bookings: all)
                } else {
                    list
                }
            }
            .background(Brand.wash)
            .navigationTitle("Zakazivanja")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showCalendar.toggle() } label: {
                        Image(systemName: showCalendar ? "list.bullet" : "calendar")
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private var list: some View {
        ScrollView {
            VStack(spacing: 12) {
                Picker("", selection: $filter) {
                    ForEach(filters, id: \.0) { Text($0.1).tag($0.0) }
                }
                .pickerStyle(.segmented)

                if loading && all.isEmpty { ProgressView().padding(.top, 30) }
                if let error { Card { Text(error).foregroundStyle(Brand.err) } }

                if shown.isEmpty && !loading {
                    Card { EmptyNote(text: "Nema zakazivanja u ovom pregledu.") }
                } else {
                    ForEach(shown) { b in
                        NavigationLink { BookingDetail(bookingId: b.id) } label: {
                            BookingRow(b: b, showDeadline: filter == "edit")
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .searchable(text: $search, prompt: "Ime, email ili telefon")
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            all = try await API.shared.get("/api/admin/bookings", as: [Booking].self)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

// MARK: - Detalji zakazivanja

struct BookingDetail: View {
    let bookingId: String
    @State private var b: Booking?
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let b {
                    Card {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(b.clientName ?? "—").font(.title3.weight(.semibold))
                                Spacer()
                                StatusTag(text: Status.booking(b.status).0, color: Status.booking(b.status).1)
                            }
                            Text("\(b.catName ?? "") · \(Fmt.date(b.date))\(b.time.map { " u \($0)" } ?? "")")
                                .font(.subheadline).foregroundStyle(.secondary)
                            if let l = b.location, !l.isEmpty {
                                Label(l, systemImage: "mappin.and.ellipse").font(.subheadline).foregroundStyle(.secondary)
                            }
                            if let a = b.age, !a.isEmpty {
                                Label(a, systemImage: "birthday.cake").font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        if let p = b.phone, !p.isEmpty {
                            linkButton("Pozovi", "phone.fill", URL(string: "tel:\(p.filter { $0.isNumber || $0 == "+" })"))
                        }
                        if let e = b.email, !e.isEmpty {
                            linkButton("Email", "envelope.fill", URL(string: "mailto:\(e)"))
                        }
                    }

                    Card {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Cena").font(.headline)
                            row("Paket", b.packageName ?? "—")
                            if let t = b.total { row("Ukupno", Fmt.money(t)) }
                            if let d = b.deposit, d > 0 {
                                row("Kapara", Fmt.money(d))
                                row("Ostatak za uplatu", Fmt.money(b.remaining))
                            }
                        }
                    }

                    if let n = b.note, !n.isEmpty {
                        Card {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Beleška").font(.headline)
                                Text(n).font(.subheadline)
                            }
                        }
                    }

                    if let d = b.deadlineDate {
                        Card {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Obrada").font(.headline)
                                Text("Rok: \(Fmt.date(d))").font(.subheadline).foregroundStyle(.secondary)
                                Button {
                                    Task { await mark(edited: b.editedAt == nil) }
                                } label: {
                                    Label(b.editedAt == nil ? "Označi kao obrađeno" : "Vrati u obradu",
                                          systemImage: b.editedAt == nil ? "checkmark.circle" : "arrow.uturn.backward")
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                }
                                .background(b.editedAt == nil ? Brand.accent : Brand.blush, in: Capsule())
                                .foregroundStyle(b.editedAt == nil ? .white : Brand.deep)
                                .disabled(busy)
                            }
                        }
                    }

                    if let m = message {
                        Text(m).font(.footnote).foregroundStyle(Brand.ok)
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                }
            }
            .padding(16)
        }
        .background(Brand.wash)
        .navigationTitle("Zakazivanje")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack {
            Text(k).foregroundStyle(.secondary)
            Spacer()
            Text(v).fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private func linkButton(_ title: String, _ icon: String, _ url: URL?) -> some View {
        Group {
            if let url {
                Link(destination: url) {
                    Label(title, systemImage: icon)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color(.systemBackground), in: Capsule())
                        .overlay(Capsule().stroke(Brand.blush, lineWidth: 1))
                }
            }
        }
    }

    private func load() async {
        b = try? await API.shared.get("/api/admin/bookings/\(bookingId)", as: Booking.self)
    }

    private func mark(edited: Bool) async {
        busy = true
        defer { busy = false }
        do {
            let updated: Booking = try await API.shared.post("/api/admin/bookings/\(bookingId)/state", ["edited": edited], as: Booking.self)
            b = updated
            message = edited ? "Označeno kao obrađeno." : "Vraćeno u obradu."
        } catch {
            message = error.localizedDescription
        }
    }
}

// MARK: - Kalendar po mesecima

struct MonthCalendar: View {
    let bookings: [Booking]
    @State private var month = Date()
    @State private var selected: String?

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2 // ponedeljak
        return c
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                HStack {
                    Button { shift(-1) } label: { Image(systemName: "chevron.left") }
                    Spacer()
                    Text(title).font(.headline)
                    Spacer()
                    Button { shift(1) } label: { Image(systemName: "chevron.right") }
                }
                .padding(.horizontal, 6)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
                    ForEach(["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"], id: \.self) {
                        Text($0).font(.caption2).foregroundStyle(.secondary)
                    }
                    ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                        dayCell(day)
                    }
                }

                if let selected {
                    let list = bookings.filter { $0.date == selected }
                    VStack(alignment: .leading, spacing: 10) {
                        Text(Fmt.date(selected)).font(.headline)
                        if list.isEmpty {
                            Card { EmptyNote(text: "Nema fotografisanja tog dana.") }
                        } else {
                            ForEach(list) { b in
                                NavigationLink { BookingDetail(bookingId: b.id) } label: { BookingRow(b: b) }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private var title: String {
        let c = cal.dateComponents([.year, .month], from: month)
        guard let m = c.month, let y = c.year else { return "" }
        return "\(Fmt.months[m - 1].capitalized) \(y)."
    }

    private func shift(_ n: Int) {
        month = cal.date(byAdding: .month, value: n, to: month) ?? month
        selected = nil
    }

    /// Spisak dana ("yyyy-MM-dd") sa praznim poljima na početku meseca.
    private var days: [String] {
        guard let first = cal.date(from: cal.dateComponents([.year, .month], from: month)),
              let range = cal.range(of: .day, in: .month, for: first) else { return [] }
        let weekday = cal.component(.weekday, from: first)
        let lead = (weekday - cal.firstWeekday + 7) % 7
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        var out = Array(repeating: "", count: lead)
        for d in range {
            if let date = cal.date(byAdding: .day, value: d - 1, to: first) { out.append(f.string(from: date)) }
        }
        return out
    }

    @ViewBuilder private func dayCell(_ day: String) -> some View {
        if day.isEmpty {
            Color.clear.frame(height: 54)
        } else {
            let list = bookings.filter { $0.date == day && $0.cancelled != true }
            let isToday = day == Fmt.today()
            VStack(spacing: 3) {
                Text(String(Int(day.suffix(2)) ?? 0))
                    .font(.subheadline.weight(isToday ? .bold : .regular))
                    .foregroundStyle(isToday ? Brand.accent : Brand.ink)
                HStack(spacing: 2) {
                    ForEach(list.prefix(3)) { _ in
                        Circle().fill(Brand.accent).frame(width: 5, height: 5)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(selected == day ? Brand.blush : Color(.systemBackground), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Brand.blush, lineWidth: 1))
            .onTapGesture { selected = day }
        }
    }
}
