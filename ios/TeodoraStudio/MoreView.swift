// Više: vaučeri, albumi, magacin i ceo panel otvoren u aplikaciji.
import SwiftUI
import WebKit

struct MoreView: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var api: API
    @State private var showLogout = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { VouchersView() } label: { Label("Poklon vaučeri", systemImage: "gift") }
                    NavigationLink { AlbumsView() } label: { Label("Album – porudžbine", systemImage: "book.closed") }
                    NavigationLink { StockView() } label: { Label("Magacin", systemImage: "shippingbox") }
                }

                Section("Ceo panel") {
                    NavigationLink { PanelWeb(path: "/admin#new") } label: { Label("Slanje fotografija", systemImage: "arrow.up.doc") }
                    NavigationLink { PanelWeb(path: "/admin#mail") } label: { Label("Pošta", systemImage: "envelope") }
                    NavigationLink { PanelWeb(path: "/admin#pages") } label: { Label("Stranice sajta", systemImage: "globe") }
                    NavigationLink { PanelWeb(path: "/admin") } label: { Label("Otvori panel", systemImage: "rectangle.on.rectangle") }
                }

                Section("Nalog") {
                    if let u = session.user {
                        HStack {
                            Image(systemName: "person.crop.circle").foregroundStyle(Brand.accent)
                            VStack(alignment: .leading) {
                                Text(u.name)
                                Text(u.role == "admin" ? "Administrator" : "Saradnik")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Text(api.normalized(api.baseURL))
                        .font(.caption).foregroundStyle(.secondary)
                    Button(role: .destructive) { showLogout = true } label: {
                        Label("Odjava", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Više")
            .confirmationDialog("Odjaviti se?", isPresented: $showLogout) {
                Button("Odjavi se", role: .destructive) { Task { await session.logout() } }
                Button("Odustani", role: .cancel) {}
            }
        }
    }
}

// MARK: - Vaučeri

struct VouchersView: View {
    @State private var list: [Voucher] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if loading && list.isEmpty { ProgressView().padding(.top, 30) }
                ForEach(list) { v in
                    Card {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(v.recipientName).font(.body.weight(.medium))
                                Spacer()
                                StatusTag(text: naziv(v.status), color: boja(v.status))
                            }
                            Text([v.code, v.value, v.fromName.map { "od \($0)" }].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                            Text("važi do \(Fmt.date(v.validUntil))").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }
                if list.isEmpty && !loading { Card { EmptyNote(text: "Nema vaučera.") } }
            }
            .padding(16)
        }
        .background(Brand.wash)
        .navigationTitle("Poklon vaučeri")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    private func naziv(_ s: String) -> String {
        s == "used" ? "Iskorišćen" : (s == "expired" ? "Istekao" : "Aktivan")
    }
    private func boja(_ s: String) -> Color {
        s == "used" ? .gray : (s == "expired" ? Brand.err : Brand.ok)
    }

    private func load() async {
        loading = true
        defer { loading = false }
        list = (try? await API.shared.get("/api/admin/vouchers", as: [Voucher].self)) ?? []
    }
}

// MARK: - Porudžbine albuma

struct AlbumsView: View {
    @State private var list: [AlbumOrder] = []
    @State private var loading = true
    @EnvironmentObject var api: API

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if loading && list.isEmpty { ProgressView().padding(.top, 30) }
                ForEach(list) { a in
                    Card {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(a.customer?.name ?? "Nedovršen album").font(.body.weight(.medium))
                                Spacer()
                                StatusTag(text: a.status == "done" ? "Završeno" : "Poručeno",
                                    color: a.status == "done" ? Brand.ok : Brand.warn)
                            }
                            Text([a.format, a.size, a.spreads.map { "\($0) duplih listova" }, a.photos.map { "\($0) fotografija" }]
                                .compactMap { $0 }.joined(separator: " · "))
                                .font(.caption).foregroundStyle(.secondary)
                            HStack {
                                Text(Fmt.money(a.price)).font(.subheadline.weight(.semibold)).foregroundStyle(Brand.deep)
                                Spacer()
                                if let u = api.absolute("/album/\(a.token)") {
                                    Link("Otvori album", destination: u).font(.caption)
                                }
                            }
                        }
                    }
                }
                if list.isEmpty && !loading { Card { EmptyNote(text: "Nema poručenih albuma.") } }
            }
            .padding(16)
        }
        .background(Brand.wash)
        .navigationTitle("Album")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        list = (try? await API.shared.get("/api/admin/album-projects", as: [AlbumOrder].self)) ?? []
    }
}

// MARK: - Magacin

struct StockView: View {
    @State private var list: [Product] = []
    @State private var loading = true

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if loading && list.isEmpty { ProgressView().padding(.top, 30) }
                ForEach(list) { p in
                    Card {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(p.name).font(.body.weight(.medium))
                                Text("minimalno \(p.minStock ?? 0)\((p.onOrder ?? 0) > 0 ? " · poručeno \(p.onOrder ?? 0)" : "")")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text("\(p.stock)")
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(p.low == true ? Brand.err : Brand.deep)
                                Text("na stanju").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                if list.isEmpty && !loading { Card { EmptyNote(text: "Nema artikala.") } }
            }
            .padding(16)
        }
        .background(Brand.wash)
        .navigationTitle("Magacin")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        list = (try? await API.shared.get("/api/admin/products", as: [Product].self)) ?? []
    }
}

// MARK: - Panel u aplikaciji (za delove koje radiš ređe: pošta, CMS, slanje fotografija)

struct PanelWeb: View {
    let path: String
    @EnvironmentObject var api: API

    var body: some View {
        Group {
            if let url = api.absolute(path) {
                WebView(url: url)
            } else {
                EmptyNote(text: "Adresa servera nije podešena.")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .ignoresSafeArea(edges: .bottom)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        let v = WKWebView(frame: .zero, configuration: cfg)
        v.allowsBackForwardNavigationGestures = true
        // prijava iz aplikacije važi i u panelu
        for c in HTTPCookieStorage.shared.cookies ?? [] where c.name == "tt_admin" {
            v.configuration.websiteDataStore.httpCookieStore.setCookie(c)
        }
        v.load(URLRequest(url: url))
        return v
    }

    func updateUIView(_ v: WKWebView, context: Context) {}
}
