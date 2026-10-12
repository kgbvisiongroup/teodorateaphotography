// Upiti sa sajta i obaveštenja iz panela.
import SwiftUI

struct RequestsView: View {
    @State private var all: [SiteRequest] = []
    @State private var notes: [NoteItem] = []
    @State private var tab = "requests"
    @State private var loading = true
    @State private var error: String?

    private var shown: [SiteRequest] {
        all.filter { $0.status != "archived" }
            .sorted { ($0.at ?? 0) > ($1.at ?? 0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    Picker("", selection: $tab) {
                        Text("Upiti sa sajta").tag("requests")
                        Text("Obaveštenja").tag("notes")
                    }
                    .pickerStyle(.segmented)

                    if loading && all.isEmpty && notes.isEmpty { ProgressView().padding(.top, 30) }
                    if let error { Card { Text(error).foregroundStyle(Brand.err) } }

                    if tab == "requests" {
                        if shown.isEmpty && !loading {
                            Card { EmptyNote(text: "Nema novih upita.") }
                        } else {
                            ForEach(shown) { r in
                                RequestCard(r: r) { Task { await load() } }
                            }
                        }
                    } else {
                        if notes.isEmpty && !loading {
                            Card { EmptyNote(text: "Nema obaveštenja.") }
                        } else {
                            ForEach(notes) { n in
                                Card {
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack {
                                            Text(n.title).font(.subheadline.weight(.medium))
                                            Spacer()
                                            if n.read != true { Circle().fill(Brand.accent).frame(width: 8, height: 8) }
                                        }
                                        if let t = n.text, !t.isEmpty {
                                            Text(t).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Text(Fmt.stamp(n.at)).font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
            .background(Brand.wash)
            .navigationTitle(tab == "requests" ? "Upiti sa sajta" : "Obaveštenja")
            .toolbar {
                if tab == "notes" && !notes.isEmpty {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Pročitano") {
                            Task {
                                _ = try? await API.shared.post("/api/admin/notifications/read", [:])
                                await load()
                            }
                        }
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            all = try await API.shared.get("/api/admin/requests", as: [SiteRequest].self)
            let n: NotesResponse = try await API.shared.get("/api/admin/notifications")
            notes = n.items
            error = nil
        } catch { self.error = error.localizedDescription }
    }
}

struct RequestCard: View {
    let r: SiteRequest
    var onChange: () -> Void
    @State private var busy = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(r.name ?? "—").font(.body.weight(.medium))
                    Spacer()
                    if r.status == "new" { StatusTag(text: "Novo", color: Brand.warn) }
                }
                Text([r.categoryName, r.date.map { Fmt.dateShort($0) }, r.time, r.location]
                    .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary)

                if let m = r.message, !m.isEmpty {
                    Text(m).font(.subheadline)
                }

                HStack(spacing: 10) {
                    if let p = r.phone, !p.isEmpty, let u = URL(string: "tel:\(p.filter { $0.isNumber || $0 == "+" })") {
                        Link(destination: u) { Label("Pozovi", systemImage: "phone").font(.caption) }
                    }
                    if let e = r.email, !e.isEmpty, let u = URL(string: "mailto:\(e)") {
                        Link(destination: u) { Label("Email", systemImage: "envelope").font(.caption) }
                    }
                    Spacer()
                    if r.status == "new" {
                        Button(busy ? "…" : "Rešeno") {
                            Task {
                                busy = true
                                _ = try? await API.shared.put("/api/admin/requests/\(r.id)", ["status": "done"])
                                busy = false
                                onChange()
                            }
                        }
                        .font(.caption.weight(.medium))
                        .buttonStyle(.borderedProminent)
                        .tint(Brand.accent)
                    }
                }
            }
        }
    }
}
